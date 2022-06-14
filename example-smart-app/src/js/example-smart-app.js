(function(window){
  window.extractData = function() {
    var ret = $.Deferred();
    function onError() {
      console.log('Loading error', arguments);
      ret.reject();
    }

    function onReady(smart)  {
      if (smart.hasOwnProperty('patient')) {
        var patient = smart.patient;
        var pt = patient.read();
        var obv = smart.patient.api.fetchAll({
                    type: 'Observation',
                   
                  });
        var enc = smart.patient.api.fetchAll({
                    type: 'Encounter',
                  });

        $.when(pt, obv).fail(onError);

        $.when(pt,enc).done(function(patient,enc) {
          analyzeEncounters(enc);
          populatEcnounterTable(enc);
        });

        
        patientSearch('SM');
        $.when(pt, obv).done(function(patient, obv) {
          var byCodes = smart.byCodes(obv, 'code');
          var gender = patient.gender;
          populatObservationTable(obv);
          var fname = '';
          var lname = '';

          if (typeof patient.name[0] !== 'undefined') {
            fname = patient.name[0].given.join(' ');
            lname = patient.name[0].family;
          }

          var height = byCodes('8302-2');
          var systolicbp = getBloodPressureValue(byCodes('55284-4'),'8480-6');
          var diastolicbp = getBloodPressureValue(byCodes('55284-4'),'8462-4');
          var hdl = byCodes('2085-9');
          var ldl = byCodes('2089-1');

          var p = defaultPatient();
          p.birthdate = patient.birthDate;
          p.gender = gender;
          p.fname = fname;
          p.lname = lname;
          p.height = getQuantityValueAndUnit(height[0]);

          if (typeof systolicbp != 'undefined')  {
            p.systolicbp = systolicbp;
          }

          if (typeof diastolicbp != 'undefined') {
            p.diastolicbp = diastolicbp;
          }

          p.hdl = getQuantityValueAndUnit(hdl[0]);
          p.ldl = getQuantityValueAndUnit(ldl[0]);

          ret.resolve(p);
        });
      } else {
        onError();
      }
    }

    FHIR.oauth2.ready(onReady, onError);
    return ret.promise();

  };

  function populatObservationTable(obs){
    $('#obsTable').empty();
    $('#obsTable').append("<tr><th>Text</th><th>Value</th><th>Unit</th>");
 
    for(var i in obs){
      var ob = obs[i]
      if(ob.valueQuantity){
        var row = "<tr><td>" + ob.code.text + "</td><td>" + ob.valueQuantity.value + "</td><td>" + ob.valueQuantity.unit + "</td></tr>";
        $('#obsTable').append(row);
      }
    }
  }

  function analyzeEncounters(enc){
    var alerts = [];
    for(var i in enc){
      var encounter = enc[i];
      if(encounter.status == 'in-progress'){
        if(encounter.type[0].text == "Inpatient"){
          if(encounter.period){
            var p = encounter.period.start;
            var now = new Date();
            var pDate = new Date(p);
            var diff = (now - pDate) / (1000 * 3600 * 24);
            if(diff && diff > 2){
              alerts.push("Encounter number " + encounter.id + " Patient has open inpatient encounter lasting longer than 2 days. Total time " + Math.round(diff) + 'days.');
              console.log('bingo!');
            }
          }
        }
        console.log("boop");
      }
    }
    
    populatTriggerMessages(alerts);
  }

  function patientSearch(text) {
   // clearPatientUI();
   // $('#patient-loading-row').show();
  
   // var form = document.getElementById('patient-search-form');
    var patientParams = {name: text};
  
    FHIR.oauth2.ready(function(smart) {
      smart.api.fetchAll({type: 'Patient', query: patientParams}).then(
  
        // Display Patient information if the call succeeded
        function(patients) {
          // If any Patients matched the criteria, display them
          if (patients.length) {
            var patientsHTML = '',
                slotReference = sessionStorage.getItem('slotReference');
  
            patients.forEach(function(patient) {
              var patientName = patient.name[0].given.join(' ') + ' ' + patient.name[0].family;
           //   patientsHTML = patientsHTML + patientHTML(slotReference, patient.id, patientName);
            });
  
            form.reset();
          //  renderPatients(patientsHTML);
          }
          // If no Patients matched the criteria, inform the user
          else {
          //  renderPatients('<p>No Patients found for the selected query parameters.</p>');
          }
        },
  
        // Display 'Failed to read Patients from FHIR server' if the call failed
        function() {
         // clearPatientUI();
        //  $('#patient-errors').html('<p>Failed to read Patients from FHIR server</p>');
        //  $('#patient-errors-row').show();
        }
      );
    });
  }

  
  function populatEcnounterTable(enc){
    $('#encTable').empty();
    $('#encTable').append("<tr><th>DATA</th></tr>");
 
    for(var i in enc){
      var ob = enc[i]
        var row = "<tr><td><code>"+JSON.stringify(ob)+"</code></td></tr>";
        $('#encTable').append(row);
      
    }
  }
  
  function populatTriggerMessages(alerts){
    $('#trigger-messages').empty();
    $('#trigger-messages').append("<tr><th>DATA</th></tr>");
    
    for(var i in alerts){
      var al = alerts[i]
        var row = "<tr><td>"+al+"</td></tr>";
        $('#trigger-messages').append(row);
      
    }
  }

  function defaultPatient(){
    return {
      fname: {value: ''},
      lname: {value: ''},
      gender: {value: ''},
      birthdate: {value: ''},
      height: {value: ''},
      systolicbp: {value: ''},
      diastolicbp: {value: ''},
      ldl: {value: ''},
      hdl: {value: ''},
    };
  }

  function getBloodPressureValue(BPObservations, typeOfPressure) {
    var formattedBPObservations = [];
    BPObservations.forEach(function(observation){
      var BP = observation.component.find(function(component){
        return component.code.coding.find(function(coding) {
          return coding.code == typeOfPressure;
        });
      });
      if (BP) {
        observation.valueQuantity = BP.valueQuantity;
        formattedBPObservations.push(observation);
      }
    });

    return getQuantityValueAndUnit(formattedBPObservations[0]);
  }

  function getQuantityValueAndUnit(ob) {
    if (typeof ob != 'undefined' &&
        typeof ob.valueQuantity != 'undefined' &&
        typeof ob.valueQuantity.value != 'undefined' &&
        typeof ob.valueQuantity.unit != 'undefined') {
          return ob.valueQuantity.value + ' ' + ob.valueQuantity.unit;
    } else {
      return undefined;
    }
  }

  window.drawVisualization = function(p) {
    //$('#holder').show();
    $('#loading').hide();
    $('#fname').html(p.fname);
    $('#lname').html(p.lname);
    $('#gender').html(p.gender);
    $('#birthdate').html(p.birthdate);
    $('#height').html(p.height);
    $('#systolicbp').html(p.systolicbp);
    $('#diastolicbp').html(p.diastolicbp);
    $('#ldl').html(p.ldl);
    $('#hdl').html(p.hdl);
  };

})(window);
