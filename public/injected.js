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

  var normalizeKey = function(key) {
    return String(key || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  };

  var valueLooksPresent = function(value) {
    return value !== undefined && value !== null && String(value).trim() !== '';
  };

  var firstFieldValue = function(records, keys) {
    var wanted = keys.map(normalizeKey);
    for (var i = 0; i < records.length; i++) {
      var row = records[i];
      if (!row) continue;
      for (var key in row) {
        if (wanted.includes(normalizeKey(key))) {
          var value = normalizeDiagnosis(row[key]);
          if (value) return value;
        }
      }
    }
    return '';
  };

  var firstLabeledValue = function(records, labelRegex, valueKeys) {
    for (var i = 0; i < records.length; i++) {
      var row = records[i];
      if (!row) continue;

      var label = normalizeDiagnosis(
        row.TEN ||
        row.LABEL ||
        row.TIEUDE ||
        row.TENCHISO ||
        row.TENCHITIET ||
        row.TEN_DICHVU ||
        row.TENPHIEU ||
        ''
      );
      if (!labelRegex.test(label)) continue;

      var value = firstFieldValue([row], valueKeys);
      if (value && value !== label) return value;
    }
    return '';
  };

  var firstDetailValueByIds = function(records, ids) {
    var wanted = ids.map(String);
    for (var i = 0; i < records.length; i++) {
      var row = records[i];
      if (!row || !wanted.includes(String(row.DICHVUTHUCHIENID || ''))) continue;
      var value = firstFieldValue([row], [
        'GIATRI_KETQUA',
        'GIATRI_KETQUA_BS',
        'KETQUACLS',
        'KETQUA',
        'GIATRI',
        'GIA_TRI',
        'VALUE',
        'NOIDUNG',
        'NOI_DUNG',
      ]);
      if (value) return value;
    }
    return '';
  };

  var collectTextValues = function(value, output) {
    if (value === null || value === undefined) return;
    if (typeof value === 'string' || typeof value === 'number') {
      var text = normalizeDiagnosis(value);
      if (text) output.push(text);
      return;
    }
    if (Array.isArray(value)) {
      for (var i = 0; i < value.length; i++) collectTextValues(value[i], output);
      return;
    }
    if (typeof value === 'object') {
      for (var key in value) collectTextValues(value[key], output);
    }
  };

  var firstTextAfterLabel = function(records, labelRegex) {
    var values = [];
    collectTextValues(records, values);

    for (var i = 0; i < values.length; i++) {
      var current = values[i];
      if (!labelRegex.test(current)) continue;

      var inline = current
        .replace(labelRegex, '')
        .replace(/^[:\-\s]+/, '')
        .trim();
      if (inline && !labelRegex.test(inline)) return inline;

      for (var j = i + 1; j < Math.min(values.length, i + 4); j++) {
        var next = values[j];
        if (next && !/^(chẩn đoán|bệnh chính|icd chính|bệnh kèm theo|chẩn đoán kèm theo|icd kèm theo)\s*:?$/i.test(next)) {
          return next;
        }
      }
    }
    return '';
  };

  var parseDetailRecords = function(detail) {
    if (!detail) return [];
    var records = detail;
    if (typeof detail === 'string') {
      if (!detail.trim()) return [];
      records = JSON.parse(detail);
    }
    if (records && records.result !== undefined) return parseDetailRecords(records.result);
    if (records && records.rows) records = records.rows;
    if (!Array.isArray(records)) records = [records];
    return records.filter(Boolean);
  };

  var getLatestTreatmentDetail = function(mauBenhPhamId) {
    if (!mauBenhPhamId || !window.jsonrpc.AjaxJson || !window.jsonrpc.AjaxJson.ajaxCALL_SP_O) return [];
    try {
      return parseDetailRecords(window.jsonrpc.AjaxJson.ajaxCALL_SP_O('NT.024.2.DETAIL', String(mauBenhPhamId), 0));
    } catch (e) {
      console.error('[OASIS API] DETAIL error:', e);
      return [];
    }
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

  var firstExisting = function(source, keys) {
    if (!source) return '';
    var wanted = keys.map(normalizeKey);
    for (var i = 0; i < keys.length; i++) {
      var value = source[keys[i]];
      if (valueLooksPresent(value)) return value;
    }
    for (var key in source) {
      if (wanted.includes(normalizeKey(key)) && valueLooksPresent(source[key])) {
        return source[key];
      }
    }
    return '';
  };

  var readDomValue = function(selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (!el) continue;
      var value = el.value || el.getAttribute('value') || el.textContent || '';
      if (valueLooksPresent(value)) return String(value).trim();
    }
    return '';
  };

  var firstWindowValue = function(keys) {
    for (var i = 0; i < keys.length; i++) {
      var value = window[keys[i]];
      if (valueLooksPresent(value)) return value;
    }
    return '';
  };

  var findGridRowByPatientCode = function(grid, maBA) {
    if (!grid || !grid.length || !maBA) return {};
    try {
      var ids = grid.jqGrid('getDataIDs') || [];
      for (var i = 0; i < ids.length; i++) {
        var row = grid.jqGrid('getRowData', ids[i]) || {};
        var rowMaBA = firstExisting(row, [
          'MABENHAN',
          'MA_BENH_AN',
          'MABENHNHAN',
          'MA_BENH_NHAN',
          'MAHOSOBENHAN',
          'MA_HO_SO_BENH_AN',
          'MAHOSOBA',
          'MA_HO_SO_BA',
          'MA_BA',
          'MABA'
        ]);
        if (String(rowMaBA).trim() === String(maBA).trim()) return row;
      }
    } catch (e) {
      console.warn('[OASIS API] Cannot scan jqGrid rows:', e);
    }
    return {};
  };

  var getGridRowData = function(grid, maBA) {
    if (!grid || !grid.length) return {};
    try {
      var selRow = grid.jqGrid('getGridParam', 'selrow');
      var rowData = selRow ? grid.jqGrid('getRowData', selRow) : {};
      if (rowData && Object.keys(rowData).length) return rowData;
    } catch (e) {
      console.warn('[OASIS API] Cannot read selected jqGrid row:', e);
    }
    return findGridRowByPatientCode(grid, maBA);
  };

  var resolveIds = function(rowData, maBA) {
    return {
      benhnhanId: firstExisting(rowData, [
        'BENHNHANID', 'BENH_NHAN_ID', 'MABENHNHAN', 'MA_BENH_NHAN',
        'MABN', 'MA_BN', 'MA_BENHNHAN', 'PATIENTID', 'PATIENT_ID'
      ]) ||
        readDomValue(['#BENHNHANID', '[name="BENHNHANID"]', '#benhnhanid', '[name="benhnhanid"]']) ||
        firstWindowValue(['benhnhanId', 'BENHNHANID', 'maBenhNhan']),
      hosobenhanId: firstExisting(rowData, [
        'HOSOBENHANID', 'HOSO_BENHAN_ID', 'HOSOBAID', 'HO_SO_BA_ID',
        'MAHOSOBENHANID', 'MA_HO_SO_BENH_AN_ID'
      ]) ||
        readDomValue(['#HOSOBENHANID', '[name="HOSOBENHANID"]']) ||
        firstWindowValue(['hosobenhanId', 'HOSOBENHANID']),
      khambenhId: firstExisting(rowData, [
        'HOSOBENHANID', 'HOSO_BENHAN_ID', 'HOSOBAID', 'HO_SO_BA_ID',
        'TIEPNHANID', 'TIEP_NHAN_ID', 'KHAMBENHID', 'KHAM_BENH_ID',
        'MADIEUTRI', 'MA_DIEU_TRI', 'MAHOSOBENHANID', 'MA_HO_SO_BENH_AN_ID'
      ]) ||
        readDomValue([
          '#KHAMBENHID',
          '[name="KHAMBENHID"]',
          '#HOSOBENHANID',
          '[name="HOSOBENHANID"]',
          '#TIEPNHANID',
          '[name="TIEPNHANID"]'
        ]) ||
        firstWindowValue(['khambenhId', 'KHAMBENHID', 'hosobenhanId', 'HOSOBENHANID', 'tiepnhanId', 'TIEPNHANID']) ||
        maBA
    };
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

    var res;
    try {
      var xhr = new XMLHttpRequest();
      var url = '/vnpthis/RestService?_search=false&rows=500&page=1&sidx=NGAYMAUBENHPHAM&sord=desc&postData=' + encodeURIComponent(JSON.stringify(params));
      xhr.open('GET', url, false);
      xhr.send(null);

      if (xhr.status !== 200) {
        console.warn('[OASIS API] DSPHIEU status:', xhr.status, xhr.responseText);
        return result;
      }

      res = JSON.parse(xhr.responseText);
    } catch (e) {
      console.error('[OASIS API] DSPHIEU error:', e);
      return result;
    }

    var rows = res.rows || [];
    if (!rows.length) return result;

    var latestSheet = pickLatestSheet(rows);
    result.sheet = latestSheet;
    result.cd = normalizeDiagnosis(
      latestSheet.CHUANDOAN ||
      latestSheet.CHANDOAN ||
      latestSheet.CHAN_DOAN ||
      latestSheet.CHANDOANVAOKHOA ||
      latestSheet.CHANDOANRAVIEN ||
      latestSheet.BENHCHINH ||
      latestSheet.MABENHCHINH ||
      latestSheet.ICDCHINH ||
      ''
    );

    var detailRecords = getLatestTreatmentDetail(latestSheet.MAUBENHPHAMID);
    if (!result.cd) {
      var detailCd = firstDetailValueByIds(detailRecords, [10]);
      var detailIcd = firstDetailValueByIds(detailRecords, [11]);
      if (detailCd && detailIcd && !detailCd.toLowerCase().includes(detailIcd.toLowerCase())) {
        result.cd = detailIcd + ' - ' + detailCd;
      } else {
        result.cd = detailCd;
      }
    }
    if (!result.cd) {
      result.cd = firstFieldValue(detailRecords, [
        'CHUANDOAN',
        'CHANDOAN',
        'CHAN_DOAN',
        'BENHCHINH',
        'ICDCHINH',
        'CHANDOANICD',
      ]) || firstLabeledValue(detailRecords, /^(chẩn đoán|chẩn đoán chính|bệnh chính|icd chính)\s*:?$/i, [
        'GIATRI',
        'GIA_TRI',
        'VALUE',
        'KETQUA',
        'KET_QUA',
        'NOIDUNG',
        'NOI_DUNG',
      ]) || firstTextAfterLabel(detailRecords, /^(chẩn đoán|chẩn đoán chính|bệnh chính|icd chính)\s*:?/i);
    }

    result.bkt = normalizeDiagnosis(
      latestSheet.BENHKEMTHEO ||
      latestSheet.BENH_KEM_THEO ||
      latestSheet.CHANDOANKEMTHEO ||
      latestSheet.CHAN_DOAN_KEM_THEO ||
      latestSheet.ICDKEMTHEO ||
      latestSheet.PHU ||
      ''
    );
    if (!result.bkt) {
      result.bkt = firstFieldValue(detailRecords, [
        'BENHKEMTHEO',
        'BENH_KEM_THEO',
        'CHANDOANKEMTHEO',
        'CHAN_DOAN_KEM_THEO',
        'ICDKEMTHEO',
        'ICD_KEM_THEO',
        'BENHPHU',
      ]) || firstLabeledValue(detailRecords, /^(bệnh kèm theo|chẩn đoán kèm theo|icd kèm theo|bệnh phụ)\s*:?$/i, [
        'GIATRI',
        'GIA_TRI',
        'VALUE',
        'KETQUA',
        'KET_QUA',
        'NOIDUNG',
        'NOI_DUNG',
      ]) || firstTextAfterLabel(detailRecords, /^(bệnh kèm theo|chẩn đoán kèm theo|icd kèm theo|bệnh phụ)\s*:?/i);
    }

    console.log('[OASIS API] Latest treatment diagnosis:', {
      mauBenhPhamId: latestSheet.MAUBENHPHAMID,
      cd: result.cd,
      bkt: result.bkt,
      rowKeys: Object.keys(latestSheet || {}),
      detailCount: detailRecords.length
    });

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
          
          var rowData = getGridRowData(grid, maBA);
          var ids = resolveIds(rowData, maBA);
          var benhnhanId = ids.benhnhanId;
          var khambenhId = ids.khambenhId;
          var hosobenhanId = ids.hosobenhanId;
          var sheetScopeId = hosobenhanId || khambenhId;

          console.log('[OASIS API] Selected patient ids:', {
            maBA: maBA,
            benhnhanId: benhnhanId,
            khambenhId: khambenhId,
            hosobenhanId: hosobenhanId,
            sheetScopeId: sheetScopeId,
            rowKeys: Object.keys(rowData || {})
          });

          if (sheetScopeId) {
            // Fallback chẩn đoán từ grid (hữu ích cho ngoại trú hoặc nếu chưa có tờ điều trị)
            var gridCd = normalizeDiagnosis(rowData.CHANDOAN || rowData.TENBENH || rowData.CHANDOAN_KHAM || rowData.CHANDOANVAOKHOA || rowData.CHANDOANRAVIEN || rowData.BENHCHINH || rowData.CHAN_DOAN || '');
            var gridBkt = normalizeDiagnosis(rowData.CHANDOANKEMTHEO || rowData.BENHKEMTHEO || rowData.PHU || '');

            var latestDiagnosis = getLatestTreatmentDiagnosis(benhnhanId, sheetScopeId);
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
