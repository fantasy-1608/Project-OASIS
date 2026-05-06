/* global $ */
(function() {
  var stripHtml = function(html) {
    return String(html || '').replace(/<[^>]*>?/gm, '').trim();
  };

  var normalizeDiagnosis = function(value) {
    return stripHtml(value)
      .replace(/^(chẩn đoán kèm theo|bệnh kèm theo|chẩn đoán|bệnh chính|kèm theo)[:\-\s]*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  var parseHisDate = function(value) {
    if (!value) return 0;
    var text = String(value).trim();
    var match = text.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (match) {
      return new Date(
        Number(match[3]),
        Number(match[2]) - 1,
        Number(match[1]),
        Number(match[4] || 0),
        Number(match[5] || 0),
        Number(match[6] || 0)
      ).getTime();
    }
    var parsed = Date.parse(text);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  var getRowTimestamp = function(row) {
    return parseHisDate(row.NGAYMAUBENHPHAM || row.NGAYTAO || row.NGAYCAPNHAT || row.NGAY || row.CREATED_AT);
  };

  var pickLatestSheet = function(rows) {
    return rows.slice().sort(function(a, b) {
      var byDate = getRowTimestamp(b) - getRowTimestamp(a);
      if (byDate !== 0) return byDate;
      return Number(b.MAUBENHPHAMID || 0) - Number(a.MAUBENHPHAMID || 0);
    })[0];
  };

  var getLatestTreatmentDiagnosis = function(benhnhanId, khambenhId) {
    var result = { cd: '', bkt: '', sheet: null };
    if (!khambenhId) return result;

    var params = {
      func: 'ajaxExecuteQueryPaging',
      uuid: window.jsonrpc.AjaxJson ? window.jsonrpc.AjaxJson.uuid : '',
      params: ['NT.024.DSPHIEU'],
      options: [
        { name: '[0]', value: '' },
        { name: '[1]', value: String(benhnhanId || '') },
        { name: '[2]', value: '4' }, // Loại tờ điều trị
        { name: '[3]', value: String(khambenhId) }
      ]
    };

    var xhr = new XMLHttpRequest();
    var url = '/vnpthis/RestService?_search=false&rows=500&page=1&sidx=NGAYMAUBENHPHAM&sord=desc&postData=' + encodeURIComponent(JSON.stringify(params));
    xhr.open('GET', url, false);
    xhr.send(null);

    if (xhr.status !== 200) return result;

    var res = JSON.parse(xhr.responseText);
    var rows = res.rows || [];
    if (!rows.length) return result;

    var latestSheet = pickLatestSheet(rows);
    result.sheet = latestSheet;
    result.cd = normalizeDiagnosis(latestSheet.CHUANDOAN || latestSheet.CHANDOAN || latestSheet.BENHCHINH || '');
    result.bkt = normalizeDiagnosis(latestSheet.BENHKEMTHEO || latestSheet.CHANDOANKEMTHEO || latestSheet.PHU || '');

    return result;
  };

  window.addEventListener('message', function(event) {
    if (event.origin !== window.location.origin) return;
    if (event.data && event.data.type === 'OASIS_REQ_FETCH_DIAGNOSIS') {
      var result = { cd: '', bkt: '' };
      var maBA = event.data.maBA;
      var eventId = event.data.eventId;

      try {
        if (window.$ && window.jsonrpc) {
          var grid = $('#grdBenhNhan');
          if (!grid.length) grid = $('#grdDSBenhNhan'); // Fallback Ngoại trú
          
          var selRow = grid.jqGrid('getGridParam', 'selrow');
          var rowData = selRow ? grid.jqGrid('getRowData', selRow) : {};
          var benhnhanId = rowData.BENHNHANID || window.$('#BENHNHANID').val() || window.benhnhanId || '';
          var khambenhId = rowData.HOSOBENHANID || rowData.TIEPNHANID || rowData.KHAMBENHID || rowData.MADIEUTRI || window.$('#KHAMBENHID').val() || window.$('#HOSOBENHANID').val() || maBA;

          if (khambenhId) {
            // Fallback chẩn đoán từ grid (hữu ích cho ngoại trú hoặc nếu chưa có tờ điều trị)
            var gridCd = normalizeDiagnosis(rowData.CHANDOAN || rowData.TENBENH || rowData.CHANDOAN_KHAM || rowData.BENHCHINH || rowData.CHAN_DOAN || '');
            var gridBkt = normalizeDiagnosis(rowData.CHANDOANKEMTHEO || rowData.BENHKEMTHEO || rowData.PHU || '');

            var latestDiagnosis = getLatestTreatmentDiagnosis(benhnhanId, khambenhId);
            result.cd = latestDiagnosis.cd;
            result.bkt = latestDiagnosis.bkt;

            // Nếu vẫn chưa lấy được từ DSPHIEU/DETAIL, dùng dữ liệu grid (ngoại trú)
            if (!result.cd && gridCd) result.cd = gridCd;
            if (!result.bkt && gridBkt) result.bkt = gridBkt;
          }
        }
      } catch (e) {
        console.error('[OASIS API] Error:', e);
      }
      
      window.postMessage({
        type: 'OASIS_RES_FETCH_DIAGNOSIS',
        eventId: eventId,
        data: result
      }, window.location.origin);
    }
  });
})();
