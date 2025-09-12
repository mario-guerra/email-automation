// Intercept Formspark (submit-form.com) forms, submit via fetch, show 3s success message, and clear fields
(function(){
  'use strict';

  function supportsFetch() {
    return typeof window.fetch === 'function' && typeof window.Promise === 'function';
  }

  function showMessage(container, text, type){
    // remove any existing message
    var existing = container.querySelector('.formspark-notice');
    if(existing) existing.remove();

    var div = document.createElement('div');
    div.className = 'formspark-notice formspark-notice-' + (type||'success');
    div.setAttribute('role','status');
    div.style.cssText = 'margin-top:10px;padding:10px 14px;border-radius:6px;font-weight:600;color:#fff;max-width:100%;box-sizing:border-box;';
    div.textContent = text;
    if(type === 'error') div.style.background = '#D9534F';
    else div.style.background = '#28A745';

    // ensure the container can position the notice if we need absolute placement
    try{
      var cs = window.getComputedStyle(container);
      if(cs && cs.position === 'static') container.style.position = 'relative';
    }catch(e){}

    // prefer absolute placement inside modal-like containers so notice is visible
    if(container.classList && (container.classList.contains('ays-pb-modal') || container.classList.contains('ays_content_box') || container.className.indexOf('ays-pb') !== -1)){
      div.style.position = 'absolute';
      div.style.top = '16px';
      div.style.left = '16px';
      div.style.right = '16px';
      div.style.zIndex = 9999;
    }

    container.appendChild(div);

    if(type !== 'error'){
      // return the element so callers can control removal/cleanup timing
      return div;
    }
    return div;
  }

  function serializeFormToJSON(form){
    var fd = new FormData(form);
    var obj = {};
    fd.forEach(function(value, key){
      // handle multiple values
      if(Object.prototype.hasOwnProperty.call(obj, key)){
        if(!Array.isArray(obj[key])) obj[key] = [obj[key]];
        obj[key].push(value);
      } else {
        obj[key] = value;
      }
    });
    return obj;
  }

  function interceptForm(form){
    if(form.__formspark_bound) return;
    form.__formspark_bound = true;

    form.addEventListener('submit', function(evt){
      // If browser doesn't support fetch, fall back to normal submit
      if(!supportsFetch()) return;

      // Only intercept Formspark endpoints
      var action = (form.getAttribute('action') || '');
      if(!(action.indexOf('submit-form.com') !== -1 || action.indexOf('formspark.io') !== -1)) return;

      evt.preventDefault();
      evt.stopPropagation();

      // find submit button(s)
      var submitBtn = form.querySelector('input[type="submit"], button[type="submit"]');
      if(submitBtn) submitBtn.disabled = true;

      // set gf_submitting flag if Gravity Forms expects it (mirror existing behavior)
      try{
        if(form.id){
          var m = form.id.match(/gform_(\d+)/);
          if(m && m[1]) window['gf_submitting_' + m[1]] = true;
        }
      }catch(e){}

      var json = serializeFormToJSON(form);

      fetch(action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(json),
        credentials: 'omit'
      }).then(function(resp){
        if(resp.ok){
          // success
          // choose a modal element to show message: prefer the modal .ays-pb-modal if present, else .ays_content_box, else the form
          var modalEl = form.closest('.ays-pb-modal') || form.closest('.ays_content_box') || form.closest('.ays-pb-modals') || form.parentElement || form;
          // ensure modalEl exists
          if(!modalEl) modalEl = form;

          var notice = showMessage(modalEl, 'Thanks — your message was sent.', 'success');

          // after 3s, clear fields and close the modal (so overlay closes along with clearing)
          setTimeout(function(){
            // remove the notice if still present
            try{ if(notice && notice.parentNode) notice.parentNode.removeChild(notice); }catch(e){}

            // clear the form fields
            try{ form.reset(); } catch(e){
              Array.prototype.slice.call(form.elements).forEach(function(el){
                try{
                  if(el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.value = '';
                  if(el.tagName === 'SELECT') el.selectedIndex = 0;
                }catch(ee){}
              });
            }

            // attempt to close an AYS modal by unchecking its modal checkbox if present
            try{
              // 1) Uncheck any modal checkboxes site-wide that match the pattern
              var checks = document.querySelectorAll('input.ays-pb-modal-check, input[id^="ays-pb-modal-checkbox_"]');
              checks.forEach(function(cb){
                try{
                  if(cb.checked){
                    cb.checked = false;
                    cb.dispatchEvent(new Event('change', {bubbles:true}));
                    cb.dispatchEvent(new Event('input', {bubbles:true}));
                  }
                  // try to click associated label (some implementations toggle via label click)
                  if(cb.id){
                    var lab = document.querySelector('label[for="' + cb.id + '"]');
                    if(lab && typeof lab.click === 'function') lab.click();
                  }
                }catch(ee){}
              });

              // 2) Click any modal close buttons as a second attempt
              var closeButtons = document.querySelectorAll('.ays-pb-modal-close, .ays-pb-modal-close_2, .ays-pb-modal-close-button');
              closeButtons.forEach(function(btn){ try{ if(typeof btn.click === 'function') btn.click(); }catch(e){} });

              // 3) Fallback: hide the closest popup root if it's still visible
              var popupRoot = form.closest('.ays-pb-modals') || form.closest('.ays-pb-modal') || form.closest('.ays_content_box');
              if(popupRoot){
                try{
                  var cs = window.getComputedStyle(popupRoot);
                  if(cs && cs.display !== 'none'){
                    // add a fade-out class then hide after transition
                    try{ popupRoot.classList.add('formspark-fade-out'); }catch(e){}
                    // ensure reflow so transition runs
                    void popupRoot.offsetWidth;
                    setTimeout(function(){
                      try{ popupRoot.style.display = 'none'; }catch(e){}
                      try{ popupRoot.classList.remove('formspark-fade-out'); }catch(e){}
                    }, 320);
                  }
                }catch(e){}
              }
            }catch(e){}

            // clear Gravity Forms submitting flag
            try{
              if(form.id){
                var m = form.id.match(/gform_(\d+)/);
                if(m && m[1]) window['gf_submitting_' + m[1]] = false;
              }
            }catch(e){}

            // re-enable submit button
            if(submitBtn) submitBtn.disabled = false;
          }, 3000);
        } else {
          return resp.text().then(function(txt){ throw new Error(txt || ('HTTP ' + resp.status)); });
        }
      }).catch(function(err){
        var container = form.closest('.ays_content_box') || form.parentElement || form;
        showMessage(container, 'Submission failed — please try again.', 'error');
        if(submitBtn) submitBtn.disabled = false;
        try{
          if(form.id){
            var m = form.id.match(/gform_(\d+)/);
            if(m && m[1]) window['gf_submitting_' + m[1]] = false;
          }
        }catch(e){}
        console.error('Formspark submit error:', err);
      });
    }, {capture:false});
  }

  function init(){
    var forms = Array.prototype.slice.call(document.querySelectorAll('form'));
    forms.forEach(function(f){
      var action = (f.getAttribute('action') || '').toLowerCase();
      if(action.indexOf('submit-form.com') !== -1 || action.indexOf('formspark.io') !== -1){
        interceptForm(f);
      }
    });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();

/* Minimal CSS for notice - injected so no stylesheet changes required */
(function(){
  var css = '.formspark-notice{box-shadow:0 2px 6px rgba(0,0,0,0.12);} .formspark-notice-success{background:#28A745;} .formspark-notice-error{background:#D9534F;} .formspark-fade-out{transition:opacity 280ms ease-in-out, transform 280ms ease-in-out; opacity:0 !important; transform: translateY(-6px) scale(0.996); }';
  var s = document.createElement('style');
  s.type = 'text/css';
  s.appendChild(document.createTextNode(css));
  document.head.appendChild(s);
})();
