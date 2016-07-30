var electron = require('electron'),
    {ipcRenderer} = electron,
    select = use('select'),
    on = use('on');

select(".auth_button").forEach( on("click", function(btn){
    var result = ('function' === typeof btn.authResult)?
      btn.authResult()
      : (btn.getAttribute("data-auth-result") || btn.textContent);
    return ipcRenderer.send( 'message', { type: 'auth-result', result: result } );
}));

ipcRenderer.on('set-auth-question', () => {
  (select(".auth_question")[0] || {}).innerText = question;
});
