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

    postUrlEncoded({
        url: form.getAttribute('action'),
        data: data
    }, function(err, submitReq){
        if(err){
            return console.error(err);
        }

        var raw = submitReq.responseText,
            registrations = JSON.parse(/registrations\s?=\s?(.+);/m.exec(raw)[1]),
            request = JSON.parse(/request\s?=\s?(.+);/m.exec(raw)[1]),
            user = /user\s?=\s?(.+);/m.exec(raw)[1],
            maxQueueId = /maxQueueId\s?=\s?(.+);/m.exec(raw)[1],
            hasTimedOut = false,
            timer;

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

        timer = setTimeout(function(){
            hasTimedOut = true;
            console.log('U2F signing has timed out.');
            divMessageBody.innerHTML = "U2F authentication took too long.";
        }, 15000);

        u2f.sign(request, function(data) {
            clearTimeout(timer);
            console.log('U2F signing has returned.');
            console.log(data);

            if ( !hasTimedOut && data && !(data.errorCode > 0) ) {
                console.log('POST U2F signing data.');
                return postUrlEncoded({
                    data: [
                    'doAuthenticate=' + encodeURIComponent(JSON.stringify(data)),
                    'request=' + encodeURIComponent(JSON.stringify(request)),
                    'registrations=' + encodeURIComponent(JSON.stringify(registrations)),
                    'user=' + encodeURIComponent(user),
                    'maxId=' + encodeURIComponent(maxQueueId)
                    ]
                }, function (err, req){
                    var raw = req.responseText,
                        auth = (/auth\s*=\s*'(.+)';/g.exec(raw) || [])[1] || '',
                        error = (/var\s+error\s*=\s*'(.*)';/.exec(raw) || [])[1] || '';
                    console.log(req);
                    if(err || error) {
                        divMessageBody.innerHTML = "<p>U2F Authentication Failed:</p>\n"+
                            (err || '') + ' ' + error;
                        return;
                    }
                    divMessageBody.innerHTML = "U2F Authentication Successful";
                });
            }
            data = data || {};
            divMessageBody.innerHTML = "<p>U2F authentication error.</p>\n"+
                data.errorCode +': '+ data.errorMessage;
        });
    });
}

function postUrlEncoded(opt, done){
    var submitReq = new XMLHttpRequest();
    submitReq.onreadystatechange = function(){
        if(submitReq.readyState === XMLHttpRequest.DONE){
            if(submitReq.status !== 200) {
                return done(submitReq.status, submitReq);
            }
            return done(null, submitReq);
        }
    };
    submitReq.open(
      opt.method || 'POST',
      opt.url || (''+window.location.href).replace(window.location.search, ''),
      true
    );
    submitReq.setRequestHeader(
        "Content-Type",
        opt.contentType || 'application/x-www-form-urlencoded'
    );
    submitReq.send( opt.data.join('&') );
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

    setTimeout( function(){
      console.log('Checking for startAuthenticate button');

      var proceedBtn = document.querySelector('#submitButton');
      if(proceedBtn && 'startAuthenticate' === proceedBtn.getAttribute('name') && proceedBtn.textContent == 'Proceed'){
        return setTimeout(function(){
          proceedBtn.click();
        },100);
      }
  },100);
  });
});
