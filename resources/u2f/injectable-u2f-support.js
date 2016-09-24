"use strict";

var remote = require('electron').remote,
  u2fc = require('u2f-client');

function captureSubmit (event) {
  var form = event.target;
  event.preventDefault();

  // prepare form data (just getting inputs because we know we can do that)
  var data = [].slice.call(form.querySelectorAll('[name]'))
    .filter( (el) => {
      return !!el;
    }).map( (cur) => {
      return cur.name + '=' + encodeURIComponent(cur.value);
    });

  var submitReq = new XMLHttpRequest();
  submitReq.onreadystatechange = function () {
    if(submitReq.readyState === XMLHttpRequest.DONE && submitReq.status === 200) {
      var raw = submitReq.responseText,
        registrations = JSON.parse(/registrations\s?=\s?(.+);/m.exec(raw)[1]),
        request = JSON.parse(/request\s?=\s?(.+);/m.exec(raw)[1]),
        user = /user\s?=\s?(.+);/m.exec(raw)[1],
        maxQueueId = /maxQueueId\s?=\s?(.+);/m.exec(raw)[1],
        hasTimedOut = false;

      console.log(submitReq.responseText);
      console.log(registrations);
      console.log(request);
      console.log(user);
      console.log(maxQueueId);

      var divForm = document.getElementById('mainBody');
      var divMessageBody = document.getElementById('messageBody');
      divForm.style.display = "none";
      divMessageBody.style.padding = "20px";
      divMessageBody.innerHTML = "Touch your U2F token";

      u2f.sign(request, function(data) {
        console.log('U2F signing has returned.');
        console.log(data);
        if ( !hasTimedOut && !(data.errorCode > 0) ) {
          form.getElementById('doAuthenticate').value = data;
          form.getElementById('request').value = request;
          form.getElementById('registrations').value = registrations;
          form.getElementById('user').value = user;
          form.getElementById('maxId').value = maxQueueId;
          form.submit();
        }
      });
      setTimeout(function(){
        hasTimedOut = true;
        console.log('U2F signing has timed out.');
      },1000);
    }
  };

  submitReq.open(
    'POST',
    form.getAttribute('action') || (''+window.location.href).replace(window.location.search, ''),
    true
  );
  submitReq.setRequestHeader("Content-Type", 'application/x-www-form-urlencoded');
  submitReq.send( data.join('&') );
}

process.once('loaded', () => {
  var webContents = remote.getCurrentWebContents();

  console.log('Adding u2f support to window.');

  global.u2f = new u2fc.BrowserApi(
    u2fc,
    (''+webContents.getURL()).replace(/(https?:\/\/.+\/?).*$/,"$1")
  );

  webContents.on('dom-ready', () => {
    console.log('Capturing form submit.');
    var form = document.getElementById('form');
    form.addEventListener('submit', captureSubmit);

    window.addEventListener('load', function(){
      console.log('Checking for startAuthenticate button');

      var proceedBtn = document.querySelector('#submitButton');
      if(proceedBtn && 'startAuthenticate' === proceedBtn.getAttribute('name') && proceedBtn.textContent == 'Proceed'){
        return setTimeout(function(){
          proceedBtn.click();
        },100);
      }
    });
  });
})
