const sentinelUtils = require('../sentinel/utils'),
      utils = require('../../utils');

const contacts = [
  {
    _id: 'district_hospital',
    name: 'District hospital',
    type: 'district_hospital',
    reported_date: new Date().getTime()
  },
  {
    _id: 'health_center',
    name: 'Health Center',
    type: 'health_center',
    parent: { _id: 'district_hospital' },
    reported_date: new Date().getTime()
  },
  {
    _id: 'clinic1',
    name: 'Clinic',
    type: 'clinic',
    parent: { _id: 'health_center', parent: { _id: 'district_hospital' } },
    contact: { _id: 'chw1', parent:  { _id: 'clinic1', parent: { _id: 'health_center', parent: { _id: 'district_hospital' } } } },
    reported_date: new Date().getTime()
  },
  {
    _id: 'chw1',
    type: 'person',
    parent: { _id: 'clinic1', parent: { _id: 'health_center', parent: { _id: 'district_hospital' } } },
    phone: 'phone1',
    name: 'chw1',
    reported_date: new Date().getTime()
  },
  {
    _id: 'person1',
    name: 'Person',
    type: 'person',
    patient_id: 'patient1',
    parent: { _id: 'clinic1', parent: { _id: 'health_center', parent: { _id: 'district_hospital' } } },
    reported_date: new Date().getTime()
  },
  {
    _id: 'person2',
    name: 'Person',
    type: 'person',
    patient_id: 'patient2',
    parent: { _id: 'clinic1', parent: { _id: 'health_center', parent: { _id: 'district_hospital' } } },
    reported_date: new Date().getTime()
  },
  {
    _id: 'clinic2',
    name: 'Clinic',
    type: 'clinic',
    parent: { _id: 'health_center', parent: { _id: 'district_hospital' } },
    contact: { _id: 'chw2', parent:  { _id: 'clinic2', parent: { _id: 'health_center', parent: { _id: 'district_hospital' } } } },
    reported_date: new Date().getTime()
  },
  {
    _id: 'chw2',
    type: 'person',
    parent: { _id: 'clinic2', parent: { _id: 'health_center', parent: { _id: 'district_hospital' } } },
    phone: 'phone2',
    name: 'chw2',
    reported_date: new Date().getTime()
  },
  {
    _id: 'person3',
    name: 'Person',
    type: 'person',
    patient_id: 'patient3',
    parent: { _id: 'clinic2', parent: { _id: 'health_center', parent: { _id: 'district_hospital' } } },
    reported_date: new Date().getTime()
  },
  {
    _id: 'person4',
    name: 'Person',
    type: 'person',
    patient_id: 'patient4',
    parent: { _id: 'clinic2', parent: { _id: 'health_center', parent: { _id: 'district_hospital' } } },
    reported_date: new Date().getTime()
  }
];

const transitionsConfig = {
  patient_reports: [{
    form: 'TEMP',
    validations: {
      list: [
        {
          property: 'temp',
          rule: 'min(30) && max(60)',
          message: [{
            locale: 'en',
            content: 'Temperature seems incorrect'
          }],
        },
      ],
      join_responses: false
    },
    messages: [{
      event_type: 'registration_not_found',
      message: [{
        locale: 'en',
        content: 'Patient not found'
      }],
    }, {
      event_type: 'report_accepted',
      message: [{
        locale: 'en',
        content: 'Temperature registered'
      }],
    }]
  }],
  alerts: [{
    form: 'TEMP',
    condition: 'doc.fields.temp > 39',
    message: 'Patient temperature high',
    recipient: 'reporting_unit'
  }],
  death_reporting: {
    mark_deceased_forms: ['DEATH'],
    date_field: 'reported_date'
  },
  default_responses: { start_date: '2018-01-01' },
  registrations: [{
    form: 'CHILD',
    events: [{
      name: 'on_create',
      trigger: 'add_patient',
      params: { patient_id_field: 'our_patient_id', patient_name_field: 'our_patient_name' },
      bool_expr: ''
    }, {
      name: 'on_create',
      trigger: 'assign_schedule',
      params: 'new patient',
      bool_expr: ''
    }],
    messages: [{
      event_type: 'report_accepted',
      message: [{
        locale: 'en',
        content: 'Patient {{patient_id}} created'
      }],
    }],
  }],
  schedules: [{
    name: 'new patient',
    start_from: 'reported_date',
    messages: [{
      offset: '1 month',
      message: [{
        locale: 'en',
        content: 'Revisit patient {{patient_id}}'
      }],
    }, {
      offset: '1 week',
      message: [{
        locale: 'en',
        content: 'First visit'
      }],
    }]
  }]
};

const formsConfig = {
  DEATH: {
    meta: { label: { en: 'Death reporting' }, code: 'DEATH'},
    fields: {
      patient_id: {
        labels: { short: { translation_key: 'patient_id' }},
        position: 1,
        type: 'string',
        length: [5, 13],
        required: true
      }
    }
  },
  TEMP: {
    meta: { label: { en: 'Fever reporting' }, code: 'TEMP'},
    fields: {
      patient_id: {
        labels: { short: { translation_key: 'patient_id' }},
        position: 0,
        type: 'string',
        length: [5, 13],
        required: true
      },
      temp: {
        labels: { short: { translation_key: 'temp' }},
        position: 1,
        type: 'string',
        length: [1, 2],
        required: true
      }
    }
  },
  CHILD: {
    meta: { label: { en: 'Child registration' }, code: 'CHILD'},
    fields: {
      our_patient_id: {
        labels: { short: { translation_key: 'patient_id' }},
        position: 0,
        type: 'string',
        length: [5, 13],
        required: true
      },
      our_patient_name: {
        labels: { short: { translation_key: 'patient_name' }},
        position: 1,
        type: 'string',
        length: [2, 10],
        required: true
      }
    }
  }
};

const messages = [{
  id: 'temp_unknown_patient',
  from: 'phone1',
  content: 'TEMP 12345 37.5'
}, {
  id: 'temp_invalid',
  from: 'phone1',
  content: 'TEMP patient1 98'
}, {
  id: 'temp_successful',
  from: 'phone1',
  content: 'TEMP patient1 37'
}, {
  id: 'temp_high',
  from: 'phone2',
  content: 'TEMP patient2 40'
}, {
  id: 'unformatted',
  from: '+501234656887',
  content: 'This is a test message'
}, {
  id: 'form_not_found',
  from: 'phone2',
  content: 'TEPM patient1 38'
}, {
  id: 'new_child',
  from: 'phone2',
  content: 'CHILD child1 Child name'
}, {
  id: 'new_child_unknown',
  from: '+501234656887',
  content: 'CHILD child2 Child name'
}, {
  id: 'dead',
  from: 'phone1',
  content: 'DEATH patient4'
}];

const waitForChanges = () => {
  const expectedMessages = messages.map(message => message.message);
  const changes = [];
  const listener = utils.db.changes({
    live: true,
    include_docs: true,
    since: 'now'
  });

  return new Promise(resolve => {
    listener.on('change', change => {
      if (change.doc.sms_message) {
        const idx = expectedMessages.findIndex(message => message === change.doc.sms_message.message);
        changes.push(change);
        expectedMessages.splice(idx, 1);
        if (!expectedMessages.length) {
          listener.cancel();
          resolve(changes);
        }
      }
    });
  });
};

const getPostOpts = (path, body) => ({
  path: path,
  method: 'POST',
  headers: { 'Content-Type':'application/json' },
  body: body
});

const getDocByPatientId = patientId => {
  return utils
    .requestOnTestDb(
      `/_design/medic-client/_view/contacts_by_reference?key=["shortcode","${patientId}"]&include_docs=true`
    )
    .then(result => result.rows);
};

const expectTransitions = (infodoc, ...transitions) => {
  expect(infodoc.transitions).toBeDefined();
  expect(Object.keys(infodoc.transitions).length).toEqual(transitions.length);
  transitions.forEach(transition => {
    expect(infodoc.transitions[transition]).toBeDefined();
    expect(infodoc.transitions[transition].ok).toEqual(true);
  });
};

const isUntransitionedDoc = doc => {
  return doc._rev.startsWith('1-') &&
         doc.errors.length === 1 &&
         doc.errors[0].code === 'sys.facility_not_found' &&
         !doc.tasks.length &&
         !doc.scheduled_tasks &&
         !doc.contact &&
         !doc.patient_id;
};

describe('transitions', () => {
  beforeAll(done => utils.saveDocs(contacts).then(done));
  afterAll(done => utils.revertDb().then(done));
  afterEach(done => utils.revertDb(contacts.map(c => c._id), true).then(done));

  it('should not run any sync transitions if none are set to be sync', () => {
    const settings = {
      transitions: {
        accept_patient_reports: { async: true },
        conditional_alerts: { async: true },
        death_reporting: { async: true },
        default_responses: { async: true },
        registration: { async: true },
        update_clinics: { async: true }
      },
      forms: formsConfig
    };
    Object.assign(settings, transitionsConfig);
    let docs,
        ids;

    return utils
      .updateSettings(settings, true)
      .then(() => Promise.all([
        waitForChanges(),
        utils.request(getPostOpts('/api/sms', { messages })),
      ]))
      .then(([ changes, messages ]) => {
        expect(messages.messages.length).toEqual(0);
        expect(changes.every(change => isUntransitionedDoc(change.doc))).toEqual(true);
        docs = changes.map(change => change.doc);
        ids = changes.map(change => change.id);
      })
      .then(() => sentinelUtils.waitForSentinel(ids))
      .then(() => Promise.all([
        sentinelUtils.getInfoDocs(ids),
        utils.getDocs(ids)
      ]))
      .then(([infos, updatedDocs]) => {
        let doc,
            infodoc,
            updatedDoc;

        //temp_unknown_patient
        doc = docs.find(doc => doc.sms_message.gateway_ref === 'temp_unknown_patient');
        infodoc = infos.find(info => info.doc_id === doc._id);
        updatedDoc = updatedDocs.find(updatedDoc => doc._id === updatedDoc._id);

        expectTransitions(infodoc, 'update_clinics', 'default_responses', 'accept_patient_reports');

        expect(updatedDoc.tasks.length).toEqual(1);
        expect(updatedDoc.tasks[0].messages[0].message).toEqual('Patient not found');
        expect(updatedDoc.tasks[0].messages[0].to).toEqual('phone1');
        expect(updatedDoc.errors.length).toEqual(1);
        expect(updatedDoc.errors[0].code).toEqual('registration_not_found');
        expect(updatedDoc.scheduled_tasks).not.toBeDefined();
        expect(updatedDoc.contact).toBeDefined();
        expect(updatedDoc.contact._id).toEqual('chw1');

        //temp_invalid
        doc = docs.find(doc => doc.sms_message.gateway_ref === 'temp_invalid');
        infodoc = infos.find(info => info.doc_id === doc._id);
        updatedDoc = updatedDocs.find(updatedDoc => doc._id === updatedDoc._id);

        expectTransitions(infodoc, 'update_clinics', 'default_responses', 'accept_patient_reports', 'conditional_alerts');

        expect(updatedDoc.tasks.length).toEqual(2);
        expect(updatedDoc.tasks[0].messages[0].message).toEqual('Temperature seems incorrect');
        expect(updatedDoc.tasks[0].messages[0].to).toEqual('phone1');
        expect(updatedDoc.tasks[1].messages[0].message).toEqual('Patient temperature high');
        expect(updatedDoc.tasks[1].messages[0].to).toEqual('phone1');
        expect(updatedDoc.errors.length).toEqual(1);
        expect(updatedDoc.errors[0].code).toEqual('invalid_temp');
        expect(updatedDoc.scheduled_tasks).not.toBeDefined();
        expect(updatedDoc.contact).toBeDefined();
        expect(updatedDoc.contact._id).toEqual('chw1');

        //temp_successful
        doc = docs.find(doc => doc.sms_message.gateway_ref === 'temp_successful');
        infodoc = infos.find(info => info.doc_id === doc._id);
        updatedDoc = updatedDocs.find(updatedDoc => doc._id === updatedDoc._id);

        expectTransitions(infodoc, 'update_clinics', 'default_responses', 'accept_patient_reports');

        expect(updatedDoc.tasks.length).toEqual(1);
        expect(updatedDoc.tasks[0].messages[0].message).toEqual('Temperature registered');
        expect(updatedDoc.tasks[0].messages[0].to).toEqual('phone1');
        expect(updatedDoc.errors.length).toEqual(0);
        expect(updatedDoc.scheduled_tasks).not.toBeDefined();
        expect(updatedDoc.contact).toBeDefined();
        expect(updatedDoc.contact._id).toEqual('chw1');

        //temp_high
        doc = docs.find(doc => doc.sms_message.gateway_ref === 'temp_high');
        infodoc = infos.find(info => info.doc_id === doc._id);
        updatedDoc = updatedDocs.find(updatedDoc => doc._id === updatedDoc._id);

        expectTransitions(infodoc, 'update_clinics', 'default_responses', 'accept_patient_reports', 'conditional_alerts');

        expect(updatedDoc.tasks.length).toEqual(2);
        expect(updatedDoc.tasks[0].messages[0].message).toEqual('Temperature registered');
        expect(updatedDoc.tasks[0].messages[0].to).toEqual('phone1'); // will default to clinic!
        expect(updatedDoc.tasks[1].messages[0].message).toEqual('Patient temperature high');
        expect(updatedDoc.tasks[1].messages[0].to).toEqual('phone2');
        expect(updatedDoc.errors.length).toEqual(0);
        expect(updatedDoc.scheduled_tasks).not.toBeDefined();
        expect(updatedDoc.contact).toBeDefined();
        expect(updatedDoc.contact._id).toEqual('chw2');

        //unformatted
        doc = docs.find(doc => doc.sms_message.gateway_ref === 'unformatted');
        infodoc = infos.find(info => info.doc_id === doc._id);
        updatedDoc = updatedDocs.find(updatedDoc => doc._id === updatedDoc._id);

        expectTransitions(infodoc, 'default_responses');

        expect(updatedDoc.tasks.length).toEqual(1);
        expect(updatedDoc.tasks[0].messages[0].message.startsWith('SMS message received')).toEqual(true);
        expect(updatedDoc.tasks[0].messages[0].to).toEqual('+501234656887');
        expect(updatedDoc.errors.length).toEqual(1);
        expect(updatedDoc.errors[0].code).toEqual('sys.facility_not_found');
        expect(updatedDoc.scheduled_tasks).not.toBeDefined();
        expect(updatedDoc.contact).not.toBeDefined();

        //form_not_found
        doc = docs.find(doc => doc.sms_message.gateway_ref === 'form_not_found');
        infodoc = infos.find(info => info.doc_id === doc._id);
        updatedDoc = updatedDocs.find(updatedDoc => doc._id === updatedDoc._id);

        expectTransitions(infodoc, 'default_responses', 'update_clinics');

        expect(updatedDoc.tasks.length).toEqual(1);
        expect(updatedDoc.tasks[0].messages[0].message.startsWith('SMS message received')).toEqual(true);
        expect(updatedDoc.tasks[0].messages[0].to).toEqual('phone2');
        expect(updatedDoc.errors.length).toEqual(0);
        expect(updatedDoc.scheduled_tasks).not.toBeDefined();
        expect(updatedDoc.contact).toBeDefined();
        expect(updatedDoc.contact._id).toEqual('chw2');

        //new_child
        doc = docs.find(doc => doc.sms_message.gateway_ref === 'new_child');
        infodoc = infos.find(info => info.doc_id === doc._id);
        updatedDoc = updatedDocs.find(updatedDoc => doc._id === updatedDoc._id);

        expectTransitions(infodoc, 'default_responses', 'update_clinics', 'registration');

        expect(updatedDoc.tasks.length).toEqual(1);
        expect(updatedDoc.tasks[0].messages[0].message).toEqual('Patient child1 created');
        expect(updatedDoc.tasks[0].messages[0].to).toEqual('phone2');
        expect(updatedDoc.errors.length).toEqual(0);
        expect(updatedDoc.contact).toBeDefined();
        expect(updatedDoc.contact._id).toEqual('chw2');
        expect(updatedDoc.scheduled_tasks).toBeDefined();
        expect(updatedDoc.scheduled_tasks.length).toEqual(2);
        expect(updatedDoc.scheduled_tasks[0].messages[0].message).toEqual('Revisit patient child1');
        expect(updatedDoc.scheduled_tasks[0].messages[0].to).toEqual('phone2');
        expect(updatedDoc.scheduled_tasks[0].state).toEqual('scheduled');
        expect(updatedDoc.scheduled_tasks[1].messages[0].message).toEqual('First visit');
        expect(updatedDoc.scheduled_tasks[1].messages[0].to).toEqual('phone2');
        expect(updatedDoc.scheduled_tasks[1].state).toEqual('scheduled');

        //new_child_unknown
        doc = docs.find(doc => doc.sms_message.gateway_ref === 'new_child_unknown');
        infodoc = infos.find(info => info.doc_id === doc._id);
        updatedDoc = updatedDocs.find(updatedDoc => doc._id === updatedDoc._id);

        expectTransitions(infodoc, 'default_responses');

        expect(updatedDoc.tasks.length).toEqual(0);
        expect(updatedDoc.errors.length).toEqual(1);
        expect(updatedDoc.errors[0].code).toEqual('sys.facility_not_found');
        expect(updatedDoc.scheduled_tasks).not.toBeDefined();
        expect(updatedDoc.contact).not.toBeDefined();
        expect(updatedDoc.patient_id).not.toBeDefined();

        //dead
        doc = docs.find(doc => doc.sms_message.gateway_ref === 'dead');
        infodoc = infos.find(info => info.doc_id === doc._id);
        updatedDoc = updatedDocs.find(updatedDoc => doc._id === updatedDoc._id);

        expectTransitions(infodoc, 'default_responses', 'update_clinics', 'death_reporting');

        expect(updatedDoc.tasks.length).toEqual(0);
        expect(updatedDoc.errors.length).toEqual(0);
        expect(updatedDoc.scheduled_tasks).not.toBeDefined();
        expect(updatedDoc.contact).toBeDefined();
        expect(updatedDoc.contact._id).toEqual('chw1');
      })
      .then(() => getDocByPatientId('child1'))
      .then(rows => {
        expect(rows.length).toEqual(1);
        expect(rows[0].doc.patient_id).toEqual('child1');
        expect(rows[0].doc.parent._id).toEqual('clinic2');
        expect(rows[0].doc.name).toEqual('Child name');
      })
      .then(() => utils.getDoc('person4'))
      .then(person => {
        expect(person.date_of_death).toBeDefined();
      });
  });

  it('should run all sync transitions and all async transitions', () => {
    const settings = {
      transitions: {
        accept_patient_reports: { async: false },
        conditional_alerts: { async: false },
        death_reporting: { async: true },
        default_responses: { async: false },
        registration: { async: false },
        update_clinics: { async: false }
      },
      forms: formsConfig
    };
    Object.assign(settings, transitionsConfig);

    // we already killed patient 4 in the test above
    messages.find(message => message.id === 'dead').content = 'DEATH patient3';
    let docs,
        ids;

    return utils
      .updateSettings(settings, true)
      .then(() => Promise.all([
        waitForChanges(),
        utils.request(getPostOpts('/api/sms', { messages })),
      ]))
      .then(([ changes, messages ]) => {
        docs = changes.map(change => change.doc);
        ids = changes.map(change => change.id);

        let doc;

        //temp_unknown_patient
        doc = docs.find(doc => doc.sms_message.gateway_ref === 'temp_unknown_patient');
        expect(doc.tasks.length).toEqual(1);
        expect(doc.tasks[0].messages[0].message).toEqual('Patient not found');
        expect(doc.tasks[0].messages[0].to).toEqual('phone1');
        expect(doc.errors.length).toEqual(1);
        expect(doc.errors[0].code).toEqual('registration_not_found');
        expect(doc.scheduled_tasks).not.toBeDefined();
        expect(doc.contact).toBeDefined();
        expect(doc.contact._id).toEqual('chw1');

        //temp_invalid
        doc = docs.find(doc => doc.sms_message.gateway_ref === 'temp_invalid');
        expect(doc.tasks.length).toEqual(2);
        expect(doc.tasks[0].messages[0].message).toEqual('Temperature seems incorrect');
        expect(doc.tasks[0].messages[0].to).toEqual('phone1');
        expect(doc.tasks[1].messages[0].message).toEqual('Patient temperature high');
        expect(doc.tasks[1].messages[0].to).toEqual('phone1');
        expect(doc.errors.length).toEqual(1);
        expect(doc.errors[0].code).toEqual('invalid_temp');
        expect(doc.scheduled_tasks).not.toBeDefined();
        expect(doc.contact).toBeDefined();
        expect(doc.contact._id).toEqual('chw1');

        //temp_successful
        doc = docs.find(doc => doc.sms_message.gateway_ref === 'temp_successful');
        expect(doc.tasks.length).toEqual(1);
        expect(doc.tasks[0].messages[0].message).toEqual('Temperature registered');
        expect(doc.tasks[0].messages[0].to).toEqual('phone1');
        expect(doc.errors.length).toEqual(0);
        expect(doc.scheduled_tasks).not.toBeDefined();
        expect(doc.contact).toBeDefined();
        expect(doc.contact._id).toEqual('chw1');

        //temp_high
        doc = docs.find(doc => doc.sms_message.gateway_ref === 'temp_high');
        expect(doc.tasks.length).toEqual(2);
        expect(doc.tasks[0].messages[0].message).toEqual('Temperature registered');
        expect(doc.tasks[0].messages[0].to).toEqual('phone2');
        expect(doc.tasks[1].messages[0].message).toEqual('Patient temperature high');
        expect(doc.tasks[1].messages[0].to).toEqual('phone2');
        expect(doc.errors.length).toEqual(0);
        expect(doc.scheduled_tasks).not.toBeDefined();
        expect(doc.contact).toBeDefined();
        expect(doc.contact._id).toEqual('chw2');

        //unformatted
        doc = docs.find(doc => doc.sms_message.gateway_ref === 'unformatted');
        expect(doc.tasks.length).toEqual(1);
        expect(doc.tasks[0].messages[0].message.startsWith('SMS message received')).toEqual(true);
        expect(doc.tasks[0].messages[0].to).toEqual('+501234656887');
        expect(doc.errors.length).toEqual(1);
        expect(doc.errors[0].code).toEqual('sys.facility_not_found');
        expect(doc.scheduled_tasks).not.toBeDefined();
        expect(doc.contact).not.toBeDefined();

        //form_not_found
        doc = docs.find(doc => doc.sms_message.gateway_ref === 'form_not_found');
        expect(doc.tasks.length).toEqual(1);
        expect(doc.tasks[0].messages[0].message.startsWith('SMS message received')).toEqual(true);
        expect(doc.tasks[0].messages[0].to).toEqual('phone2');
        expect(doc.errors.length).toEqual(0);
        expect(doc.scheduled_tasks).not.toBeDefined();
        expect(doc.contact).toBeDefined();
        expect(doc.contact._id).toEqual('chw2');

        //new_child
        doc = docs.find(doc => doc.sms_message.gateway_ref === 'new_child');
        expect(doc.tasks.length).toEqual(1);
        expect(doc.tasks[0].messages[0].message).toEqual('Patient child1 created');
        expect(doc.tasks[0].messages[0].to).toEqual('phone2');
        expect(doc.errors.length).toEqual(0);
        expect(doc.contact).toBeDefined();
        expect(doc.contact._id).toEqual('chw2');
        expect(doc.scheduled_tasks).toBeDefined();
        expect(doc.scheduled_tasks.length).toEqual(2);
        expect(doc.scheduled_tasks[0].messages[0].message).toEqual('Revisit patient child1');
        expect(doc.scheduled_tasks[0].messages[0].to).toEqual('phone2');
        expect(doc.scheduled_tasks[0].state).toEqual('scheduled');
        expect(doc.scheduled_tasks[1].messages[0].message).toEqual('First visit');
        expect(doc.scheduled_tasks[1].messages[0].to).toEqual('phone2');
        expect(doc.scheduled_tasks[1].state).toEqual('scheduled');

        //new_child_unknown
        doc = docs.find(doc => doc.sms_message.gateway_ref === 'new_child_unknown');
        expect(doc.tasks.length).toEqual(0);
        expect(doc.errors.length).toEqual(1);
        expect(doc.errors[0].code).toEqual('sys.facility_not_found');
        expect(doc.scheduled_tasks).not.toBeDefined();
        expect(doc.contact).not.toBeDefined();
        expect(doc.patient_id).not.toBeDefined();

        //dead
        doc = docs.find(doc => doc.sms_message.gateway_ref === 'dead');
        expect(doc.tasks.length).toEqual(0);
        expect(doc.errors.length).toEqual(0);
        expect(doc.scheduled_tasks).not.toBeDefined();
        expect(doc.contact).toBeDefined();
        expect(doc.contact._id).toEqual('chw1');

        expect(messages.messages.length).toEqual(9);
        expect(messages.messages.length).toEqual(docs.reduce((sum, doc) => sum + doc.tasks.length, 0));
        docs.forEach(doc => {
          doc.tasks.forEach(task => {
            task.messages.forEach(message => {
              expect(messages.messages.find(m => m.id === message.uuid)).toBeDefined();
            });
          });
        });
      })
      .then(() => Promise.all([
        sentinelUtils.getInfoDocs(ids),
        getDocByPatientId('child1'),
        utils.getDoc('person3')
      ]))
      .then(([infos, child1, person3]) => {
        let doc,
            infodoc;

        //temp_unknown_patient
        doc = docs.find(doc => doc.sms_message.gateway_ref === 'temp_unknown_patient');
        infodoc = infos.find(info => info.doc_id === doc._id);
        expectTransitions(infodoc, 'default_responses', 'update_clinics', 'accept_patient_reports');

        //temp_invalid
        doc = docs.find(doc => doc.sms_message.gateway_ref === 'temp_invalid');
        infodoc = infos.find(info => info.doc_id === doc._id);
        expectTransitions(infodoc, 'default_responses', 'update_clinics', 'accept_patient_reports', 'conditional_alerts');

        //temp_successful
        doc = docs.find(doc => doc.sms_message.gateway_ref === 'temp_successful');
        infodoc = infos.find(info => info.doc_id === doc._id);
        expectTransitions(infodoc, 'default_responses', 'update_clinics', 'accept_patient_reports');

        //temp_high
        doc = docs.find(doc => doc.sms_message.gateway_ref === 'temp_high');
        infodoc = infos.find(info => info.doc_id === doc._id);
        expectTransitions(infodoc, 'default_responses', 'update_clinics', 'accept_patient_reports', 'conditional_alerts');

        //unformatted
        doc = docs.find(doc => doc.sms_message.gateway_ref === 'unformatted');
        infodoc = infos.find(info => info.doc_id === doc._id);
        expectTransitions(infodoc, 'default_responses');

        //form_not_found
        doc = docs.find(doc => doc.sms_message.gateway_ref === 'form_not_found');
        infodoc = infos.find(info => info.doc_id === doc._id);
        expectTransitions(infodoc, 'default_responses', 'update_clinics');

        //new_child
        doc = docs.find(doc => doc.sms_message.gateway_ref === 'new_child');
        infodoc = infos.find(info => info.doc_id === doc._id);
        expectTransitions(infodoc, 'default_responses', 'update_clinics', 'registration');

        //new_child_unknown
        doc = docs.find(doc => doc.sms_message.gateway_ref === 'new_child_unknown');
        infodoc = infos.find(info => info.doc_id === doc._id);
        expectTransitions(infodoc, 'default_responses');

        //dead
        doc = docs.find(doc => doc.sms_message.gateway_ref === 'dead');
        infodoc = infos.find(info => info.doc_id === doc._id);
        expectTransitions(infodoc, 'default_responses', 'update_clinics');
        expect(infodoc.transitions.death_reporting).not.toBeDefined();

        expect(child1.length).toEqual(1);
        expect(child1[0].doc.patient_id).toEqual('child1');
        expect(child1[0].doc.parent._id).toEqual('clinic2');
        expect(child1[0].doc.name).toEqual('Child name');

        expect(person3.date_of_death).not.toBeDefined();
      })
      .then(() => sentinelUtils.waitForSentinel(ids))
      .then(() => Promise.all([
        sentinelUtils.getInfoDocs(ids),
        utils.getDoc('person3')
      ]))
      .then(([infos, person3]) => {
        let doc,
            infodoc;

        //temp_unknown_patient
        doc = docs.find(doc => doc.sms_message.gateway_ref === 'temp_unknown_patient');
        infodoc = infos.find(info => info.doc_id === doc._id);
        expectTransitions(infodoc, 'default_responses', 'update_clinics', 'accept_patient_reports');

        //temp_invalid
        doc = docs.find(doc => doc.sms_message.gateway_ref === 'temp_invalid');
        infodoc = infos.find(info => info.doc_id === doc._id);
        expectTransitions(infodoc, 'default_responses', 'update_clinics', 'accept_patient_reports', 'conditional_alerts');

        //temp_successful
        doc = docs.find(doc => doc.sms_message.gateway_ref === 'temp_successful');
        infodoc = infos.find(info => info.doc_id === doc._id);
        expectTransitions(infodoc, 'default_responses', 'update_clinics', 'accept_patient_reports');

        //temp_high
        doc = docs.find(doc => doc.sms_message.gateway_ref === 'temp_high');
        infodoc = infos.find(info => info.doc_id === doc._id);
        expectTransitions(infodoc, 'default_responses', 'update_clinics', 'accept_patient_reports', 'conditional_alerts');

        //unformatted
        doc = docs.find(doc => doc.sms_message.gateway_ref === 'unformatted');
        infodoc = infos.find(info => info.doc_id === doc._id);
        expectTransitions(infodoc, 'default_responses');

        //form_not_found
        doc = docs.find(doc => doc.sms_message.gateway_ref === 'form_not_found');
        infodoc = infos.find(info => info.doc_id === doc._id);
        expectTransitions(infodoc, 'default_responses', 'update_clinics');

        //new_child
        doc = docs.find(doc => doc.sms_message.gateway_ref === 'new_child');
        infodoc = infos.find(info => info.doc_id === doc._id);
        expectTransitions(infodoc, 'default_responses', 'update_clinics', 'registration');

        //new_child_unknown
        doc = docs.find(doc => doc.sms_message.gateway_ref === 'new_child_unknown');
        infodoc = infos.find(info => info.doc_id === doc._id);
        expectTransitions(infodoc, 'default_responses');

        //dead
        doc = docs.find(doc => doc.sms_message.gateway_ref === 'dead');
        infodoc = infos.find(info => info.doc_id === doc._id);
        expectTransitions(infodoc, 'default_responses', 'update_clinics', 'death_reporting');

        expect(person3.date_of_death).toBeDefined();
      });
  });

  it('should not crash services when transitions are misconfigured', () => {
    const settings = {
      transitions: {
        accept_patient_reports: { async: false },
        conditional_alerts: { async: false },
        death_reporting: { async: false },
        default_responses: { async: false },
        registration: { async: false },
        update_clinics: { async: false }
      },
      forms: formsConfig
    };

    delete transitionsConfig.death_reporting.mark_deceased_forms;
    Object.assign(settings, transitionsConfig);

    const contact = {
      _id: 'person5',
      name: 'Person',
      type: 'person',
      patient_id: 'patient5',
      parent: { _id: 'clinic2', parent: { _id: 'health_center', parent: { _id: 'district_hospital' } } },
      reported_date: new Date().getTime()
    };
    // we already killed patient 3 and 4 in the test above
    messages.find(message => message.id === 'dead').content = 'DEATH patient5';

    let ids;

    return utils
      .updateSettings(settings, true)
      .then(() => utils.saveDoc(contact))
      .then(() => Promise.all([
        waitForChanges(),
        utils.request(getPostOpts('/api/sms', { messages: messages })),
      ]))
      .then(([changes, messages]) => {
        expect(messages.messages.length).toEqual(0);
        expect(changes.every(change => isUntransitionedDoc(change.doc))).toEqual(true);
        ids = changes.map(change => change.id);
      })
      // Sentinel won't process these, so we can't wait for a metadata update, but let's give it 5 seconds just in case
      .then(() => new Promise(resolve => setTimeout(() => resolve(), 5000)))
      .then(() => Promise.all([
        sentinelUtils.getInfoDocs(ids),
        utils.getDocs(ids)
      ]))
      .then(([infos, updatedDocs]) => {
        infos.forEach(info => expect(!info));
        expect(updatedDocs.every(isUntransitionedDoc)).toEqual(true);
      })
      .then(() => getDocByPatientId('child1'))
      .then(rows => {
        expect(rows.length).toEqual(0);
      })
      .then(() => utils.getDoc('person5'))
      .then(person => {
        expect(person.date_of_death).not.toBeDefined();
      });
  });
});