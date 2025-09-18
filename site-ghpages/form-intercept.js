// Intercept form submissions targeting the Apps Script endpoint, submit via fetch, show 3s success message, and clear fields
(function(){
  'use strict';

  function supportsFetch() {
    return typeof window.fetch === 'function' && typeof window.Promise === 'function';
  }

  function showMessage(container, text, type){
    var existing = container.querySelector('.form-intercept-notice');
    if(existing) existing.remove();

    var div = document.createElement('div');
    div.className = 'form-intercept-notice ' + (type === 'error' ? 'form-intercept-error' : 'form-intercept-success');
    div.setAttribute('role','status');
    div.textContent = text;

    try{
      var cs = window.getComputedStyle(container);
      if(cs && cs.position === 'static') container.style.position = 'relative';
    }catch(e){}

    if(container.classList && (container.classList.contains('ays-pb-modal') || container.classList.contains('ays_content_box') || container.className.indexOf('ays-pb') !== -1)){
      div.classList.add('form-intercept-modal-pos');
    }

    container.appendChild(div);
    return div;
  }

  function serializeFormToObject(form){
    var fd = new FormData(form);
    var obj = {};
    fd.forEach(function(value, key){
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
    if(form.__app_bound) return;
    form.__app_bound = true;

    form.addEventListener('submit', function(evt){
      if(!supportsFetch()) return;

      var action = (form.getAttribute('action') || '').toLowerCase();
      // Only intercept Apps Script endpoint (script.google.com/macros) or other same-origin endpoints
      if(!(action.indexOf('script.google.com/macros') !== -1 || action.indexOf(window.location.origin) !== -1)) return;

      evt.preventDefault();
      evt.stopPropagation();

      var submitBtn = form.querySelector('input[type="submit"], button[type="submit"]');
      if(submitBtn) submitBtn.disabled = true;

      try{
        if(form.id){
          var m = form.id.match(/gform_(\d+)/);
          if(m && m[1]) window['gf_submitting_' + m[1]] = true;
        }
      }catch(e){}

  var jsonObj = serializeFormToObject(form);

      // Send as form-urlencoded (Apps Script handles both, but keep parity with original behavior)
      var bodyPairs = [];
      var encode = encodeURIComponent;
      Object.keys(jsonObj).forEach(function(k){
        var v = jsonObj[k];
        if(Array.isArray(v)){
          v.forEach(function(item){ bodyPairs.push(encode(k) + '=' + encode(item)); });
        } else {
          bodyPairs.push(encode(k) + '=' + encode(v));
        }
      });
      var bodyString = bodyPairs.join('&');

      fetch(action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'Accept': 'application/json' },
        body: bodyString,
        credentials: 'omit'
      }).then(function(resp){
        if(resp.ok){
          var modalEl = form.closest('.ays-pb-modal') || form.closest('.ays_content_box') || form.closest('.ays-pb-modals') || form.parentElement || form;
          if(!modalEl) modalEl = form;

          // Allow per-form custom success message via data-success attribute
          var successMsg = form.getAttribute('data-success') || 'Thanks — your message was sent.';
          var notice = showMessage(modalEl, successMsg, 'success');

          setTimeout(function(){
            try{ if(notice && notice.parentNode) notice.parentNode.removeChild(notice); }catch(e){}
            try{ form.reset(); } catch(e){
              Array.prototype.slice.call(form.elements).forEach(function(el){
                try{
                  if(el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.value = '';
                  if(el.tagName === 'SELECT') el.selectedIndex = 0;
                }catch(ee){}
              });
            }

            try{
              var checks = document.querySelectorAll('input.ays-pb-modal-check, input[id^="ays-pb-modal-checkbox_"]');
              checks.forEach(function(cb){
                try{ if(cb.checked){ cb.checked = false; cb.dispatchEvent(new Event('change', {bubbles:true})); cb.dispatchEvent(new Event('input', {bubbles:true})); } }catch(ee){}
                try{ if(cb.id){ var lab = document.querySelector('label[for="' + cb.id + '"]'); if(lab && typeof lab.click === 'function') lab.click(); } }catch(ee){}
              });

              var closeButtons = document.querySelectorAll('.ays-pb-modal-close, .ays-pb-modal-close_2, .ays-pb-modal-close-button');
              closeButtons.forEach(function(btn){ try{ if(typeof btn.click === 'function') btn.click(); }catch(e){} });

              var popupRoot = form.closest('.ays-pb-modals') || form.closest('.ays-pb-modal') || form.closest('.ays_content_box');
              if(popupRoot){
                try{ popupRoot.classList.add('form-intercept-fade'); void popupRoot.offsetWidth; setTimeout(function(){ try{ popupRoot.style.display = 'none'; }catch(e){} try{ popupRoot.classList.remove('form-intercept-fade'); }catch(e){} }, 320); }catch(e){}
              }
            }catch(e){}

            try{
              if(form.id){
                var m = form.id.match(/gform_(\d+)/);
                if(m && m[1]) window['gf_submitting_' + m[1]] = false;
              }
            }catch(e){}

            if(submitBtn) submitBtn.disabled = false;
          }, 3000);

        } else {
          return resp.text().then(function(txt){ throw new Error(txt || ('HTTP ' + resp.status)); });
        }
      }).catch(function(err){
          var container = form.closest('.ays_content_box') || form.parentElement || form;
        // Allow per-form custom error message via data-error attribute
        var errMsg = form.getAttribute('data-error') || 'Submission failed — please try again.';
        showMessage(container, errMsg, 'error');
        if(submitBtn) submitBtn.disabled = false;
        try{ if(form.id){ var m = form.id.match(/gform_(\d+)/); if(m && m[1]) window['gf_submitting_' + m[1]] = false; } }catch(e){}
        console.error('App submit error:', err);
      });

    }, {capture:false});
  }

  function init(){
    var forms = Array.prototype.slice.call(document.querySelectorAll('form'));
    forms.forEach(function(f){
      var action = (f.getAttribute('action') || '').toLowerCase();
      if(action.indexOf('script.google.com/macros') !== -1 || action.indexOf(window.location.origin) !== -1){
        interceptForm(f);
      }
    });
  }

  // Catch programmatic form.submit() calls and route them through our intercept for matching forms.
  // This prevents other scripts from bypassing the fetch-based flow and causing a redirect.
  (function(){
    try{
      var origSubmit = HTMLFormElement.prototype.submit;
      HTMLFormElement.prototype.submit = function(){
        try{
          var action = (this.getAttribute && (this.getAttribute('action') || '') || '').toLowerCase();
          if(action.indexOf('script.google.com/macros') !== -1 || action.indexOf(window.location.origin) !== -1){
            // If our intercept hasn't been bound yet, bind and trigger submit event so our handler runs.
            if(!this.__app_bound) interceptForm(this);
            var evt = new Event('submit', { bubbles: true, cancelable: true });
            var defaultNotPrevented = this.dispatchEvent(evt);
            // If preventDefault was called by listeners, don't proceed with native submit.
            if(defaultNotPrevented){
              // If the event wasn't prevented, allow the original submit to proceed.
              return origSubmit.call(this);
            }
            // Otherwise, our intercept prevented default and will handle the submission via fetch.
            return;
          }
        }catch(e){/* if anything goes wrong, fall back to native submit */}
        return origSubmit.call(this);
      };
    }catch(e){/* environment doesn't allow prototype override; ignore */}
  })();

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
