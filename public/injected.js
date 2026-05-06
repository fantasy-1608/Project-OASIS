/* global $ */
(function() {
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
            var stripHtml = function(html) { return String(html || '').replace(/<[^>]*>?/gm, '').trim(); };
            var gridCd = stripHtml(rowData.CHANDOAN || rowData.TENBENH || rowData.CHANDOAN_KHAM || rowData.BENHCHINH || rowData.CHAN_DOAN || '');
            var gridBkt = stripHtml(rowData.CHANDOANKEMTHEO || rowData.BENHKEMTHEO || rowData.PHU || '');

            var params = {
                func: 'ajaxExecuteQueryPaging',
                uuid: window.jsonrpc.AjaxJson ? window.jsonrpc.AjaxJson.uuid : '',
                params: ['NT.024.DSPHIEU'],
                options: [
                    { name: '[0]', value: '' },
                    { name: '[1]', value: String(benhnhanId) },
                    { name: '[2]', value: '4' }, // Loại tờ điều trị
                    { name: '[3]', value: String(khambenhId) }
                ]
            };
            
            var xhr = new XMLHttpRequest();
            var url = '/vnpthis/RestService?_search=false&rows=500&page=1&sidx=NGAYMAUBENHPHAM&sord=desc&postData=' + encodeURIComponent(JSON.stringify(params));
            xhr.open('GET', url, false); // Synchronous for simplicity
            xhr.send(null);
            
            if (xhr.status === 200) {
                var res = JSON.parse(xhr.responseText);
                var rows = res.rows || [];
                if (rows.length > 0) {
                    var latestSheet = rows[0]; 
                    
                    result.cd = latestSheet.CHANDOAN || latestSheet.CHUANDOAN || latestSheet.BENHCHINH || '';
                    result.bkt = latestSheet.CHANDOANKEMTHEO || latestSheet.BENHKEMTHEO || latestSheet.PHU || '';
                    
                    // Bỏ điều kiện (!result.cd || !result.bkt) vì có lúc CHANDOAN chỉ trả về mỗi mã ICD ("K21.9")
                    // Luôn gọi NT.024.2.DETAIL để quét mờ (Universal Scanner) tìm chẩn đoán đầy đủ
                    if (latestSheet.MAUBENHPHAMID) {
                        var detail = window.jsonrpc.AjaxJson.ajaxCALL_SP_O('NT.024.2.DETAIL', String(latestSheet.MAUBENHPHAMID), 0);
                        var recs = [];
                        if (typeof detail === 'string' && detail.trim() !== '') recs = JSON.parse(detail);
                        else if (typeof detail === 'object' && detail !== null) recs = detail;
                        if (recs && recs.rows) recs = recs.rows;
                        else if (!Array.isArray(recs)) recs = [recs];
                        
                        var allDiagnoses = [];
                        var icdPatternContains = /(?:^|[^A-Z0-9])[A-Z]\d{2,3}(?:\.\d{1,2})?(?:[^A-Z0-9]|$)/i;
                        
                        // Extract from Detail records
                        for (var i = 0; i < recs.length; i++) {
                           var r = recs[i];
                           if (!r) continue;
                           for (var k in r) {
                               var uk = k.toUpperCase();
                               var val = String(r[k] || '').trim();
                               if (val.length < 5) continue; // Diagnosis strings are usually longer
                               if (uk.includes('HINHANH') || uk.includes('QUANGTUYEN') || uk.includes('YEUCAU') || uk === 'TEN') continue;
                               
                               if (icdPatternContains.test(val)) {
                                   // Loại bỏ các prefix như "Chẩn đoán kèm theo: ", "Bệnh chính: "
                                   var cleaned = val.replace(/^(chẩn đoán kèm theo|bệnh kèm theo|chẩn đoán|bệnh chính|kèm theo)[:\-\s]*/i, '').trim();
                                   if (!allDiagnoses.includes(cleaned)) {
                                       allDiagnoses.push(cleaned);
                                   }
                               }
                           }
                        }
                        
                        // Xếp lại: cái đầu tiên làm chẩn đoán chính, các cái sau gộp thành bệnh kèm theo
                        if (allDiagnoses.length > 0) {
                            if (!result.cd) {
                                result.cd = allDiagnoses[0];
                                if (allDiagnoses.length > 1) {
                                    result.bkt = allDiagnoses.slice(1).join('; ');
                                }
                            } else {
                                // Nâng cấp: Nếu DETAIL có chuỗi chứa result.cd (mã ICD) nhưng dài hơn (có tên bệnh), lấy nó làm result.cd
                                var betterCdIndex = allDiagnoses.findIndex(function(d) {
                                    return d.includes(result.cd) && d.length > result.cd.length + 3;
                                });
                                if (betterCdIndex !== -1) {
                                    result.cd = allDiagnoses[betterCdIndex]; // Lấy bản full
                                    allDiagnoses.splice(betterCdIndex, 1); // Xóa khỏi allDiagnoses để không bị lọt vào bệnh kèm theo
                                } else if (result.cd.length <= 6) {
                                    // Fallback: Nếu result.cd chỉ là ICD code (vd "S22.30") và không có chuỗi nào chứa hoàn toàn nó,
                                    // nhưng có chuỗi bắt đầu bằng mã đó (vd "S22.30 - Gãy xương sườn")
                                    var startMatch = allDiagnoses.findIndex(function(d) { 
                                        return d.startsWith(result.cd); 
                                    });
                                    if (startMatch !== -1) {
                                        result.cd = allDiagnoses[startMatch];
                                        allDiagnoses.splice(startMatch, 1);
                                    }
                                }
                                
                                // Nếu đã có chẩn đoán chính từ DSPHIEU, thì tất cả những cái tìm được ở DETAIL đưa vào kèm theo (loại trừ cái bị trùng)
                                var filtered = allDiagnoses.filter(function(d) {
                                    return !result.cd.includes(d) && !d.includes(result.cd);
                                });
                                if (filtered.length > 0) {
                                    var newBkt = filtered.join('; ');
                                    result.bkt = result.bkt ? result.bkt + '; ' + newBkt : newBkt;
                                }
                            }
                        }
                    }
                }
            }

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
