// Intercept Gravity Forms submission to Apps Script, show success for 3s, then close modal
(function(){
  'use strict';

  function supportsFetch(){ return typeof fetch === 'function' && typeof Promise === 'function'; }

  function showMessage(container, text, type){
    var existing = container.querySelector('.form-intercept-notice');
    if(existing) { try{ existing.remove(); }catch(e){} }

    var div = document.createElement('div');
    div.className = 'form-intercept-notice ' + (type === 'error' ? 'form-intercept-error' : 'form-intercept-success');
    div.setAttribute('role','status');
    div.textContent = text;

    div.style.cssText = 'margin-top:10px;padding:10px 14px;border-radius:6px;font-weight:600;color:#fff;max-width:100%;box-sizing:border-box;';
    div.style.background = (type === 'error') ? '#D9534F' : '#28A745';

    try {
      var cs = window.getComputedStyle(container);
      if(cs && cs.position === 'static') container.style.position = 'relative';
    } catch(e){}

    if(container.classList && (container.classList.contains('ays-pb-modal') || container.classList.contains('ays_content_box') || ((container.className)||'').indexOf('ays-pb') !== -1)){
      div.style.position = 'absolute';
      div.style.top = '16px';
      div.style.left = '16px';
      div.style.right = '16px';
      div.style.zIndex = 9999;
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

  function closeModalFromForm(form){
    try{
      var checks = document.querySelectorAll('input.ays-pb-modal-check, input[id^="ays-pb-modal-checkbox_"]');
      checks.forEach(function(cb){ try{ if(cb.checked){ cb.checked = false; cb.dispatchEvent(new Event('change', {bubbles:true})); cb.dispatchEvent(new Event('input', {bubbles:true})); } }catch(e){} });
      var closeButtons = document.querySelectorAll('.ays-pb-modal-close, .ays-pb-modal-close_2, .ays-pb-modal-close-button');
      closeButtons.forEach(function(btn){ try{ if(typeof btn.click === 'function') btn.click(); }catch(e){} });
      var popupRoot = form.closest('.ays-pb-modals') || form.closest('.ays-pb-modal') || form.closest('.ays_content_box');
      if(popupRoot){
        try{
          var cs2 = window.getComputedStyle(popupRoot);
          if(cs2 && cs2.display !== 'none'){
            popupRoot.classList.add('form-intercept-fade');
            void popupRoot.offsetWidth;
            setTimeout(function(){
              try{ popupRoot.style.display = 'none'; }catch(e){}
              try{ popupRoot.classList.remove('form-intercept-fade'); }catch(e){}
            }, 320);
          }
        }catch(e){}
      }
    }catch(e){}
  }

  function bind(form){
    if(form.__app_bound) return;
    form.__app_bound = true;

    form.addEventListener('submit', function(evt){
      if(!supportsFetch()) return;

      var action = (form.getAttribute('action') || '');
      if(!(action.indexOf('script.google.com/macros') !== -1 || action.indexOf(window.location.origin) !== -1)) return;

      evt.preventDefault();
      evt.stopPropagation();

      var submitBtn = form.querySelector('input[type="submit"], button[type="submit"]');
      if(submitBtn) submitBtn.disabled = true;

      try {
        if(form.id){
          var m = form.id.match(/gform_(\d+)/);
          if(m && m[1]) window['gf_submitting_' + m[1]] = true;
        }
      } catch(e){}

      var jsonObj = serializeFormToObject(form);
      var bodyPairs = [];
      var encode = encodeURIComponent;
      Object.keys(jsonObj).forEach(function(k){
        var v = jsonObj[k];
        if(Array.isArray(v)) v.forEach(function(item){ bodyPairs.push(encode(k) + '=' + encode(item)); });
        else bodyPairs.push(encode(k) + '=' + encode(v));
      });
      var bodyString = bodyPairs.join('&');

      fetch(action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'Accept': 'application/json' },
        body: bodyString,
        credentials: 'omit'
      }).then(function(resp){
        var modalEl = form.closest('.ays-pb-modal') || form.closest('.ays_content_box') || form.closest('.ays-pb-modals') || form.parentElement || form;
        var successMsg = form.getAttribute('data-success') || 'Thanks — your message was sent.';
        var errorMsg = form.getAttribute('data-error') || 'Submission failed — please try again.';

        return resp.text().then(function(txt){
          var ok = resp.status < 400;
          var json = {};
          try{ json = JSON.parse(txt); }catch(e){}
          if(ok && (!json || json.success !== false)){
            var notice = showMessage(modalEl, successMsg, 'success');
            setTimeout(function(){
              try{ if(notice && notice.parentNode) notice.parentNode.removeChild(notice); }catch(e){}
              try{ form.reset(); }catch(e){
                Array.prototype.slice.call(form.elements).forEach(function(el){
                  try{
                    if(el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.value = '';
                    if(el.tagName === 'SELECT') el.selectedIndex = 0;
                  }catch(ee){}
                });
              }
              closeModalFromForm(form);
              try{ if(form.id){ var m2 = form.id.match(/gform_(\d+)/); if(m2 && m2[1]) window['gf_submitting_' + m2[1]] = false; } }catch(e){}
              if(submitBtn) submitBtn.disabled = false;
            }, 3000);
          } else {
            showMessage(modalEl, errorMsg, 'error');
            try{ if(form.id){ var me = form.id.match(/gform_(\d+)/); if(me && me[1]) window['gf_submitting_' + me[1]] = false; } }catch(e){}
            if(submitBtn) submitBtn.disabled = false;
          }
        });
      }).catch(function(err){
        var modalEl = form.closest('.ays-pb-modal') || form.closest('.ays_content_box') || form.closest('.ays-pb-modals') || form.parentElement || form;
        var errorMsg = form.getAttribute('data-error') || 'Submission failed — please try again.';
        showMessage(modalEl, errorMsg, 'error');
        try{ if(form.id){ var mx = form.id.match(/gform_(\d+)/); if(mx && mx[1]) window['gf_submitting_' + mx[1]] = false; } }catch(e){}
        if(submitBtn) submitBtn.disabled = false;
        console.error('Network error:', err);
      });
    });
  }

  function init(){
    try{
      var css = '.form-intercept-notice{box-shadow:0 2px 6px rgba(0,0,0,0.12);} .form-intercept-success{background:#28A745;} .form-intercept-error{background:#D9534F;} .form-intercept-fade{transition:opacity 280ms ease-in-out, transform 280ms ease-in-out; opacity:0 !important; transform: translateY(-6px) scale(0.996);}';
      var s = document.createElement('style'); s.type = 'text/css'; s.appendChild(document.createTextNode(css)); document.head.appendChild(s);
    }catch(e){}

    Array.prototype.slice.call(document.querySelectorAll('form')).forEach(bind);
    try{
      var obs = new MutationObserver(function(muts){
        muts.forEach(function(m){
          Array.prototype.slice.call(m.addedNodes||[]).forEach(function(n){
            try{
              if(n && n.tagName === 'FORM') bind(n);
              if(n && n.querySelectorAll){ Array.prototype.slice.call(n.querySelectorAll('form')).forEach(bind); }
            }catch(e){}
          });
        });
      });
      obs.observe(document.documentElement, {childList:true, subtree:true});
    }catch(e){}
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
