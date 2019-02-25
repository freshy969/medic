const _ = require('underscore'),
      async = require('async'),
      db = require('../db'),
      lineage = require('@medic/lineage')(Promise, db.medic),
      utils = require('../lib/utils'),
      logger = require('../lib/logger'),
      config = require('../config'),
      infodoc = require('../lib/infodoc');


/*
 * Add new transitions here to make them available for configuration and execution.
 * Transitions are executed in the order they appear in this array.
 *
 * (For security reasons, we want to avoid doing a `require` based on random input,
 *  hence we maintain this index of transitions.)
 *
 * Transition on this list:
 *  - Are disabled by default, and can be enabled in configuration
 *  - should be documented as to what they do and how they are configured in
 *    medic-docs
 */
const AVAILABLE_TRANSITIONS = [
  'update_clinics',
  'registration',
  'accept_patient_reports',
  'generate_patient_id_on_people',
  'default_responses',
  'update_sent_by',
  'update_sent_forms',
  'death_reporting',
  'conditional_alerts',
  'multi_report_alerts',
  'update_notifications',
  'update_scheduled_reports',
  'resolve_pending',
  'muting'
];

/*
 * Load transitions using `require` based on what is in AVAILABLE_TRANSITIONS
 * constant and what is enabled in the `transitions` property in the settings
 * data.  Log warnings on failure.
 */
const loadTransitions = (synchronous = false) => {
  const self = module.exports;
  const transitionsConfig = config.get('transitions') || [];
  const transitions = [];
  let loadError = false;

  // Load all configured transitions
  AVAILABLE_TRANSITIONS.forEach(transition => {
    const conf = transitionsConfig[transition];

    const disabled = conf && conf.disable;
    const asyncOnly = conf && !conf.async;

    if (!conf || disabled || (asyncOnly && synchronous)) {
      return logger.warn(`Disabled transition "${transition}"`);
    }

    try {
      transitions.push(self._loadTransition(transition));
    } catch (e) {
      loadError = true;
      logger.error(`Failed loading transition "${transition}"`);
      logger.error('%o', e);
    }
  });

  // Warn if there are configured transitions that are not available
  Object.keys(transitionsConfig).forEach(key => {
    if (!AVAILABLE_TRANSITIONS.includes(key)) {
      loadError = true;
      logger.error(`Unknown transition "${key}"`);
    }
  });

  if (loadError) {
    throw new Error('Transitions are disabled until the above configuration errors are fixed.');
  } else {
    return transitions;
  }
};

const loadTransition = key => {
  logger.info(`Loading transition "${key}"`);
  const transition = require('./' + key);
  if (transition.init) {
    transition.init();
  }

  return { key: key, module: transition };
};

/*
 * Determines whether a transition is okay to run on a document.  Removed
 * repeatable logic, assuming all transitions are repeatable without adverse
 * effects.
 */
const canRun = ({ key, change, transition }) => {
  const doc = change.doc;
  const info = change.info;

  const isRevSame = (doc, info) => {
    if (info.transitions && info.transitions[key]) {
      return parseInt(doc._rev) === parseInt(info.transitions[key].last_rev);
    }
    if (doc.transitions && doc.transitions[key]) {
      return parseInt(doc._rev) === parseInt(doc.transitions[key].last_rev);
    }
    logger.debug(
      `isRevSame tested true on transition ${key} for doc ${change.id} seq ${change.seq}`
    );
    return false;
  };

  /*
   * Ignore deleted records, confirm transition has filter function and
   * skip transition if filter returns false.
   *
   * If transition was already applied then only run again if doc rev is not
   * equal to transition rev.  If revs are the same then transition just ran.
   */
  return Boolean(
    change &&
      !change.deleted &&
      doc &&
      !isRevSame(doc, info) &&
      transition.filter(doc, info)
  );
};

/*
 * All transitions reference the same change.doc and work in series to
 * apply changes to it.  A transition is free to make async calls but the next
 * transition will only run after the previous transitions's callback is
 * called.  This is a performance optimization that allows us to apply N
 * transitions (updates) to a document with the cost of a single database
 * change/write.
 */
const applyTransition = ({ key, change, transition }, callback) => {
  logger.debug(
    `calling transition.onMatch for doc ${change.id} and transition ${key} seq ${change.seq}`
  );

  /*
   * Transitions are async and should return true if the document has
   * changed.  If a transition errors then log the error, but don't return it
   * because that will stop the series and the other transitions won't run.
   */
  transition
    .onMatch(change)
    .then(changed => {
      logger.debug(
        `finished transition ${key} doc ${change.id} is ${changed ? 'changed' : 'unchanged'} seq ${change.seq}`
      );
      if (!changed) {
        return changed;
      }
      return infodoc.updateTransition(change, key, true).then(() => {
        return changed;
      });
    })
    .catch(err => {
      console.log(err);
      // adds an error to the doc but it will only get saved if there are
      // other changes too.
      const message = err.message || JSON.stringify(err);
      utils.addError(change.doc, {
        code: `${key}_error'`,
        message: `Transition error on ${key}: ${message}`,
      });
      logger.error(`transition ${key} errored on doc ${change.id} seq ${change.seq}: ${JSON.stringify(err)}`);
      if (!err.changed) {
        return false;
      }
      return infodoc.updateTransition(change, key, false).then(() => {
        return true;
      });
    })
    .then(changed => callback(null, changed)); // return the promise instead
};

const processChange = (change, transitions, callback) => {
  lineage
    .fetchHydratedDoc(change.id)
    .then(doc => {
      change.doc = doc;
      return infodoc.get(change).then(infoDoc => {
        change.info = infoDoc;
        // Remove transitions from doc since those
        // will be handled by the info doc(sentinel db) after this
        if (change.doc.transitions) {
          delete change.doc.transitions;
        }
        applyTransitions(change, transitions, callback);
      });
    })
    .catch(err => {
      logger.error('transitions: fetch failed for %s : %o', change.id, err);
      return callback(err);
    });
};

const applyTransitions = (change, transitions, callback) => {
  const operations = transitions
    .map(transition => {
      const opts = {
        key: transition.key,
        change: change,
        transition: transition.module,
      };
      if (!canRun(opts)) {
        logger.debug(
          `canRun test failed on transition ${transition.key} for doc ${change.id} seq ${change.seq}`
        );
        return;
      }
      return _.partial(applyTransition, opts, _);
    })
    .filter(transition => !!transition);

  /*
   * Run transitions in series and finalize. We ignore err here
   * because it is never returned, we process it within the operation
   * function.  All we care about are results and whether we need to
   * save or not.
   */
  async.series(operations, (err, results) => finalize({ change, results }, callback));
};


/*
 * Save the doc if we have changes from transitions, otherwise transitions
 * did nothing and saving is unnecessary.  If results has a true value in
 * it then a change was made.
 */
const finalize = ({ change, results }, callback) => {
  logger.debug(`transition results: ${JSON.stringify(results)}`);

  const changed = _.some(results, i => Boolean(i));
  if (!changed) {
    logger.debug(
      `nothing changed skipping saveDoc for doc ${change.id} seq ${change.seq}`
    );
    return callback();
  }
  logger.debug(`calling saveDoc on doc ${change.id} seq ${change.seq}`);

  lineage.minify(change.doc);
  db.medic.put(change.doc, err => {
    // todo: how to handle a failed save? for now just
    // waiting until next change and try again.
    if (err) {
      logger.error(
        `error saving changes on doc ${change.id} seq ${
          change.seq
          }: ${JSON.stringify(err)}`
      );
    } else {
      logger.info(`saved changes on doc ${change.id} seq ${change.seq}`);
    }
    return callback();
  });
};

const availableTransitions = () => {
  return AVAILABLE_TRANSITIONS;
};

module.exports = {
  _loadTransition: loadTransition,
  availableTransitions: availableTransitions,
  loadTransitions: loadTransitions,
  canRun: canRun,
  applyTransition: applyTransition,
  applyTransitions: applyTransitions,
  finalize: finalize,
  processChange: processChange
};