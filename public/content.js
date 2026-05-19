/* global chrome */
// content.js
// Inject into VNPT HIS to provide OASIS integration

console.log('🧞 [OASIS] Content script loaded into HIS');

// Inject the API bridge script into the page context
const script = document.createElement('script');
script.src = chrome.runtime.getURL('injected.js');
script.onload = function() {
    this.remove();
};
(document.head || document.documentElement).appendChild(script);

let oasisCapacity = { morning: 0, afternoon: 0, date: '' };

// Listen for messages from OASIS Background/SidePanel
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'OASIS_CAPACITY_UPDATE') {
    oasisCapacity = msg.payload;
  }
  
  if (msg.type === 'OPEN_PATIENT') {
    const maBA = msg.payload.maBA;
    const hoTen = msg.payload.hoTen;
    console.log('[OASIS] Received reverse navigation request for:', { maBA, hoTen });
    
    const docs = typeof getAccessibleDocuments === 'function' ? getAccessibleDocuments() : [document];
    
    let gridInput = null;
    let globalInput = null;
    let globalBtn = null;

    for (const doc of docs) {
      // 1. Tìm input lọc trên Grid (dưới các cột Họ tên)
      const headers = Array.from(doc.querySelectorAll('th, td')).filter(el => {
        const t = (el.innerText || el.textContent || '').trim().toLowerCase();
        return t === 'họ tên' || t === 'tên bệnh nhân';
      });

      for (const th of headers) {
        // Tìm input nằm trong cell hiện tại hoặc ở dòng filter bên dưới có cùng chỉ số cột
        let input = th.querySelector('input[type="text"], input:not([type])');
        if (!input) {
           const row = th.parentElement;
           if (row && row.nextElementSibling) {
             const children = Array.from(row.children);
             const index = children.indexOf(th);
             if (index > -1) {
               const cellBelow = row.nextElementSibling.children[index];
               if (cellBelow) {
                 input = cellBelow.querySelector('input[type="text"], input:not([type])');
               }
             }
           }
        }
        if (input && isVisibleElement(input)) {
          gridInput = input;
          break;
        }
      }
      
      if (gridInput) break;

      // 2. Tìm dựa trên name/id phổ biến của lưới (Họ tên)
      if (!gridInput) {
        const potentialGridInputs = Array.from(doc.querySelectorAll('input[type="text"], input:not([type])')).filter(el => {
          const idName = (el.id + ' ' + el.name).toLowerCase();
          return (idName.includes('hoten') || idName.includes('ho_ten') || idName.includes('tenbn')) && isVisibleElement(el);
        });
        if (potentialGridInputs.length > 0) gridInput = potentialGridInputs[0];
      }
      if (gridInput) break;
      
      // 3. Tìm global input (bên trái) - vẫn dùng Mã BA
      if (!globalInput) {
        globalInput = doc.querySelector('input[name*="maBenhAn" i], input[id*="maBenhAn" i], input[placeholder*="Mã bệnh án" i]');
        globalBtn = doc.querySelector('button[id*="btnSearch" i], button[id*="btnTimKiem" i]') ||
          Array.from(doc.querySelectorAll('button')).find(btn => btn.textContent.includes('Tìm kiếm')) ||
          doc.querySelector('.btn-primary');
      }
    }

    if (gridInput && hoTen) {
      console.log('[OASIS] Found target grid input for reverse navigation (Họ tên):', gridInput);
      gridInput.focus();
      
      // Giả lập gõ phím theo logic Aladinn Sign: chừa lại ký tự cuối để gõ
      const textToType = String(hoTen).trim().toUpperCase();
      if (textToType.length > 1) {
        const firstPart = textToType.slice(0, -1);
        const lastChar = textToType.slice(-1);
        
        // Điền phần đầu
        gridInput.value = firstPart;
        gridInput.dispatchEvent(new Event('input', { bubbles: true }));
        gridInput.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Đợi một chút rồi gõ ký tự cuối
        setTimeout(() => {
          gridInput.value = textToType;
          gridInput.dispatchEvent(new Event('input', { bubbles: true }));
          
          const charCode = lastChar.charCodeAt(0);
          gridInput.dispatchEvent(new KeyboardEvent('keydown', { key: lastChar, keyCode: charCode, which: charCode, bubbles: true }));
          gridInput.dispatchEvent(new KeyboardEvent('keypress', { key: lastChar, keyCode: charCode, which: charCode, bubbles: true }));
          gridInput.dispatchEvent(new KeyboardEvent('keyup', { key: lastChar, keyCode: charCode, which: charCode, bubbles: true }));
          
          // Giả lập phím Enter để chốt bộ lọc
          setTimeout(() => {
            gridInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, which: 13, bubbles: true }));
            gridInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, which: 13, bubbles: true }));
          }, 100);
        }, 50);
      } else {
        // Tên quá ngắn thì dùng cách cũ
        gridInput.value = textToType;
        gridInput.dispatchEvent(new Event('input', { bubbles: true }));
        gridInput.dispatchEvent(new Event('change', { bubbles: true }));
        gridInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
        gridInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }));
      }
    } else if (globalInput) {
      console.log('[OASIS] Falling back to global search (Mã BA):', globalInput);
      globalInput.focus();
      globalInput.value = maBA;
      globalInput.dispatchEvent(new Event('input', { bubbles: true }));
      globalInput.dispatchEvent(new Event('change', { bubbles: true }));
      
      if (globalBtn) {
        globalBtn.click();
      } else {
        globalInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
        globalInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }));
      }
    } else {
      console.warn('[OASIS] Could not find any input to search for Patient');
    }
  }
});

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function extractHisPatientData(anchorNode) {
  let currentEl = anchorNode;
  let bannerText = currentEl ? currentEl.innerText : '';
  let maxDepth = 15;
  while (currentEl && currentEl !== document.body && maxDepth > 0) {
    if (currentEl.innerText && currentEl.innerText.includes('|') && currentEl.innerText.length > 50) {
      bannerText = currentEl.innerText;
      if (bannerText.match(/(?:^|\n)\s*(\d{8,12})\s*\|/)) break;
    }
    currentEl = currentEl.parentElement;
    maxDepth--;
  }

  let maBA = '', hoTen = '', chanDoan = 'Đang chờ cập nhật', benhKemTheo = '', ngayNhapVien = '';
  let gender = '', birth_year = '';

  const nameMatch = bannerText.match(/(?:^|\n)\s*(\d{8,12})\s*\|\s*([^|]+)\s*\|/);
  if (nameMatch) {
    maBA = nameMatch[1].trim();
    hoTen = nameMatch[2].trim();
  }

  const demoMatch = bannerText.match(/\|\s*(Nam|Nữ)\s*-\s*(\d{4})\s*\|/i);
  if (demoMatch) {
    gender = demoMatch[1].trim();
    birth_year = demoMatch[2].trim();
  } else {
    const genderMatch = bannerText.match(/\|\s*(Nam|Nữ)\s*\|/i);
    if (genderMatch) gender = genderMatch[1].trim();
    
    const ageMatch = bannerText.match(/(\d{4})\s*\(\d+\s*[Tt]uổi\)/i);
    if (ageMatch) {
      birth_year = ageMatch[1].trim();
    } else {
      const yearMatch = bannerText.match(/\|\s*(\d{4})\s*\|/);
      if (yearMatch) birth_year = yearMatch[1].trim();
    }
  }

  const admDateMatch = bannerText.match(/\|\s*(\d{1,4}[/-]\d{1,2}[/-]\d{1,4})\s+\d{1,2}:\d{2}:\d{2}\s*\|/);
  if (admDateMatch) {
    ngayNhapVien = admDateMatch[1];
  }

  const diagMatch = bannerText.match(/\|\s*\d{1,4}[/-]\d{1,2}[/-]\d{1,4}\s+\d{1,2}:\d{2}:\d{2}\s*\|\s*([^|]+?)(?:\s*\||\s*$|\n)/);
  if (diagMatch) {
    chanDoan = diagMatch[1].trim();
  } else {
    const fallbackMatch = bannerText.match(/\|\s*([A-Z]\d{2}(?:\.\d+)?\s*-\s*[^|]+?)(?:\s*\||\s*$|\n)/);
    if (fallbackMatch) chanDoan = fallbackMatch[1].trim();
  }

  return { maBA, hoTen, chanDoan, benhKemTheo, ngayNhapVien, gender, birth_year };
}

function extractRoomName(text) {
  if (!text) return '';
  const m = text.match(/(?:Buồng|Phòng|P\.)\s*([^)\s,]+)/i);
  if (m) {
      let name = m[1].trim();
      const dvMatch = name.match(/^DV(\d+)$/i);
      if (dvMatch) return dvMatch[1];
      return name;
  }
  const parts = text.split(/[-/]/);
  const lastPart = parts[parts.length - 1].replace(/[()]/g, '').trim();
  return lastPart.length < 10 ? lastPart : lastPart.substring(0, 5);
}

function extractRoomFromDOM() {
  const docs = getAccessibleDocuments();
  for (const doc of docs) {
    const walker = doc.createTreeWalker(doc.body || doc.documentElement, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    let prevText = '';
    while (node) {
      const text = normalizeText(node.nodeValue || '');
      if (text.length > 0) {
        if (/^giường\s*:?$/i.test(prevText) && /(?:buồng|phòng)/i.test(text)) {
          return extractRoomName(text);
        } else if (/^giường/i.test(text) && /(?:buồng|phòng)/i.test(text)) {
          return extractRoomName(text);
        }
        prevText = text;
      }
      node = walker.nextNode();
    }
  }
  return '';
}

function appendUniqueParts(base, additions) {
  const parts = String(base || '').split(';').map(part => normalizeText(part)).filter(Boolean);
  additions.flatMap(value => String(value || '').split(';')).forEach(value => {
    const item = normalizeText(value).replace(/^;+\s*/, '');
    if (!item) return;
    const exists = parts.some(existing => {
      const a = existing.toLowerCase();
      const b = item.toLowerCase();
      return a === b || a.includes(b) || b.includes(a);
    });
    if (!exists) parts.push(item);
  });
  return parts.join('; ');
}

function looksLikeDiagnosisValue(value) {
  const text = normalizeText(value);
  if (!text || text.length < 5) return false;
  if (/^\d+(?:[.,]\d+)?$/.test(text)) return false;
  if (/^[A-Z]\d{2}(?:\.\d+)?\s*[-–]/i.test(text)) return true;
  if (/[A-Z]\d{2}(?:\.\d+)?\s*[-–]/i.test(text)) return true;
  return /[A-Za-zÀ-ỹ]/.test(text) && text.length >= 12;
}

function isVisibleElement(el) {
  if (!el || !el.getBoundingClientRect) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return false;
  const style = el.ownerDocument.defaultView.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) !== 0;
}

function getAccessibleDocuments(rootDoc = document, seen = new Set()) {
  const docs = [];
  if (!rootDoc || seen.has(rootDoc)) return docs;
  seen.add(rootDoc);
  docs.push(rootDoc);

  rootDoc.querySelectorAll('iframe').forEach(iframe => {
    try {
      const childDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (childDoc) {
        docs.push(...getAccessibleDocuments(childDoc, seen));
      }
    } catch {
      // Cross-origin or not ready.
    }
  });

  return docs;
}

function querySelectorAcrossFrames(selectors) {
  const docs = getAccessibleDocuments();
  for (const doc of docs) {
    for (const selector of selectors) {
      const elements = Array.from(doc.querySelectorAll(selector));
      for (const el of elements) {
        if (isVisibleElement(el) && looksLikeDiagnosisValue(el.value || el.innerText || el.textContent)) {
          return el;
        }
      }
    }
  }
  return null;
}

function fieldValue(field) {
  return normalizeText(field?.value || field?.innerText || field?.textContent || '');
}

function visibleDiagnosisFields(doc) {
  return Array.from(doc.querySelectorAll('textarea, input[type="text"], input:not([type]), [contenteditable="true"]'))
    .filter(field => isVisibleElement(field) && looksLikeDiagnosisValue(fieldValue(field)));
}

function visibleLabelElements(doc, labelRegex) {
  const labels = [];
  const walker = doc.createTreeWalker(doc.body || doc.documentElement, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();

  while (node) {
    const text = normalizeText(node.nodeValue || '');
    const el = node.parentElement || node.parentNode;
    if (text && labelRegex.test(text) && isVisibleElement(el)) labels.push(el);
    node = walker.nextNode();
  }

  return labels;
}

function findValueByVisibleLabel(labelRegex) {
  const docs = getAccessibleDocuments();

  for (const doc of docs) {
    const fields = visibleDiagnosisFields(doc);
    const labels = visibleLabelElements(doc, labelRegex);

    for (const label of labels) {
      const labelRect = label.getBoundingClientRect();
      const candidates = fields.map(field => {
        if (field === label || label.contains(field)) return null;
        const fieldRect = field.getBoundingClientRect();
        const dy = fieldRect.top - labelRect.bottom;
        if (dy < -6 || dy > 90) return null;

        const leftDelta = Math.abs(fieldRect.left - labelRect.left);
        if (leftDelta > 140 && fieldRect.right < labelRect.left) return null;

        return {
          field,
          score: (Math.max(dy, 0) * 10) + leftDelta,
        };
      }).filter(Boolean).sort((a, b) => a.score - b.score);

      if (candidates.length) return fieldValue(candidates[0].field);
    }
  }

  for (const doc of docs) {
    for (const field of visibleDiagnosisFields(doc)) {
      const value = fieldValue(field);

      const labelTexts = [];
      if (field.id) {
        const label = doc.querySelector(`label[for="${CSS.escape(field.id)}"]`);
        if (label && isVisibleElement(label)) labelTexts.push(label.innerText || label.textContent || '');
      }

      let sibling = field.previousElementSibling;
      let siblingCount = 0;
      while (sibling && siblingCount < 4) {
        if (isVisibleElement(sibling) && !sibling.matches('textarea, input, select, [contenteditable="true"]')) {
          const text = normalizeText(sibling.innerText || sibling.textContent || '');
          if (text) labelTexts.push(text);
        }
        sibling = sibling.previousElementSibling;
        siblingCount++;
      }

      const parentPrevious = field.parentElement?.previousElementSibling;
      if (parentPrevious && !parentPrevious.querySelector('textarea, input, select, [contenteditable="true"]')) {
        labelTexts.push(parentPrevious.innerText || parentPrevious.textContent || '');
      }

      const matched = labelTexts.some(text => labelRegex.test(normalizeText(text)));
      if (matched) return value;
    }
  }

  return '';
}

function extractCurrentTreatmentTextareas() {
  const getValue = (selectors) => {
    const el = querySelectorAcrossFrames(selectors);
    return el ? normalizeText(el.value || el.innerText || el.textContent) : '';
  };

  return {
    cd: getValue([
      '#tcDieuTritxtCHUANDOAN',
      'textarea[id*="CHUANDOAN" i]',
      'textarea[name*="CHUANDOAN" i]',
      'textarea[id*="CHANDOAN" i]:not([id*="KEM" i])',
      'textarea[name*="CHANDOAN" i]:not([name*="KEM" i])',
      'input[id*="CHUANDOAN" i]',
      'input[name*="CHUANDOAN" i]',
      'input[id*="CHANDOAN" i]:not([id*="KEM" i])',
      'input[name*="CHANDOAN" i]:not([name*="KEM" i])',
    ]) || findValueByVisibleLabel(/^(chẩn đoán|bệnh chính|chẩn đoán chính|icd chính)\s*:?\s*$/i),
    bkt: getValue([
      '#tcDieuTritxtBENHKEMTHEO',
      'textarea[id*="kem" i]',
      'textarea[name*="kem" i]',
      'textarea[id*="phu" i]',
      'textarea[name*="phu" i]',
      'textarea[id*="BENHKEMTHEO"]',
      'textarea[name*="BENHKEMTHEO"]',
      'textarea[id*="CHANDOANKEMTHEO"]',
      'textarea[name*="CHANDOANKEMTHEO"]',
      'input[id*="kem" i]',
      'input[name*="kem" i]',
      'input[id*="phu" i]',
      'input[name*="phu" i]',
    ]) || findValueByVisibleLabel(/^(bệnh kèm theo|chẩn đoán kèm theo|icd kèm theo|bệnh phụ)\s*:?\s*$/i),
  };
}

// Inject "Lên dự kiến mổ" button into HIS UI
function injectScheduleButtons() {
  // Tìm element chứa chữ "Loại bệnh án:" trong vùng banner Hành chính
  const xpath = "//*[contains(text(), 'Loại bệnh án:')]";
  const matchingElements = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
  
  if (matchingElements.snapshotLength > 0) {
    // Lấy phần tử đầu tiên tìm thấy
    const matchingElement = matchingElements.snapshotItem(0);
    
    // Tránh chèn trùng lặp
    const parentNode = matchingElement.parentNode;
    if (parentNode && parentNode.querySelector('.oasis-schedule-btn')) return;
    if (matchingElement.querySelector('.oasis-schedule-btn')) return;

    const initialData = extractHisPatientData(parentNode);

    // Create the OASIS button
    const btn = document.createElement('button');
    btn.className = 'oasis-schedule-btn';
    btn.innerHTML = '📅 Lên dự kiến mổ';
    btn.style.cssText = `
      background: #f59e0b; color: white; border: none; border-radius: 4px;
      padding: 3px 10px; font-size: 13px; margin-left: 16px; cursor: pointer;
      font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      vertical-align: middle; display: inline-flex; align-items: center; gap: 4px;
    `;
    
    // Cảnh báo sức chứa
    const totalToday = oasisCapacity.morning + oasisCapacity.afternoon;
    if (totalToday >= 8) {
      btn.style.background = '#ef4444'; 
      btn.title = `⚠️ Hôm nay đã có ${totalToday} dự kiến mổ. Cân nhắc chuyển sang ngày mai.`;
    } else {
      btn.title = 'Chuyển thông tin bệnh nhân này sang OASIS để xếp dự kiến mổ';
    }

    // Smart Highlight
    const surgicalKeywords = ['viêm ruột thừa', 'gãy', 'u nang', 'thoát vị', 'sỏi', 'ung thư', 'vỡ', 'chấn thương', 'tổn thương nội sọ', 'rách', 'sai khớp'];
    const isSurgical = surgicalKeywords.some(kw => initialData.chanDoan.toLowerCase().includes(kw));
    if (isSurgical) {
      btn.style.animation = 'oasisPulse 2s infinite';
    }

    btn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const originalText = btn.innerHTML;
      const currentData = extractHisPatientData(parentNode);
      const clickMaBA = currentData.maBA || initialData.maBA;
      const clickHoTen = currentData.hoTen || initialData.hoTen;
      const clickNgayNhapVien = currentData.ngayNhapVien || initialData.ngayNhapVien;
      
      if (!clickMaBA) {
        alert('⚠️ OASIS: Không thể trích xuất thông tin bệnh nhân. Vui lòng chọn lại bệnh nhân hoặc tải lại trang!');
        return;
      }

      btn.innerHTML = '⏳ Đang lấy dữ liệu...';

      // Tạo một Promise để chờ dữ liệu từ Injected Script
      const fetchDiagnosisFromAPI = () => {
        return new Promise((resolve) => {
          const eventId = 'oasis_diag_' + Date.now() + '_' + Math.random().toString(36).slice(2);
          let settled = false;
          let timeoutId = null;

          const finish = (data) => {
            if (settled) return;
            settled = true;
            if (timeoutId) clearTimeout(timeoutId);
            window.removeEventListener('message', listener);
            resolve(data || { cd: '', bkt: '' });
          };
          
          const listener = (event) => {
            if (event.data && event.data.type === 'OASIS_RES_FETCH_DIAGNOSIS' && event.data.eventId === eventId) {
              finish(event.data.data);
            }
          };
          window.addEventListener('message', listener);

          window.postMessage({
             type: 'OASIS_REQ_FETCH_DIAGNOSIS',
             eventId: eventId,
             maBA: clickMaBA
          }, window.location.origin);

          // Timeout sau 3s nếu có lỗi
          timeoutId = setTimeout(() => finish({ cd: '', bkt: '' }), 3000);
        });
      };

      const textareaData = extractCurrentTreatmentTextareas();
      console.log('[OASIS] Current treatment textareas:', textareaData);

      const apiData = await fetchDiagnosisFromAPI();
      const apiCd = normalizeText(apiData?.cd || '');
      const apiBkt = normalizeText(apiData?.bkt || '');
      const fallbackCd = currentData.chanDoan || initialData.chanDoan || '';

      console.log('[OASIS] API treatment diagnosis:', apiData);

      // DOM là nguồn đúng nhất khi tờ điều trị đang mở; API vẫn bổ sung khi DOM thiếu một phần.
      const bestCd = textareaData.cd || apiCd || fallbackCd;
      const bestBkt = textareaData.bkt || apiBkt;
      const finalDiagnosis = appendUniqueParts(bestCd, [bestBkt]);

      btn.innerHTML = originalText;
      const clickIsSurgical = surgicalKeywords.some(kw => finalDiagnosis.toLowerCase().includes(kw));
      
      const clickGender = currentData.gender || initialData.gender || '';
      const clickBirthYear = currentData.birth_year || initialData.birth_year || '';
      const clickRoom = extractRoomFromDOM();
      
      const payload = {
        patient_id: clickMaBA,
        patient_name: clickHoTen,
        diagnosis: finalDiagnosis,
        admission_date: clickNgayNhapVien || null,
        priority: clickIsSurgical ? 'urgent' : 'elective',
        gender: clickGender,
        birth_year: clickBirthYear,
        room: clickRoom
      };

      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ oasis_pending_surgery: payload }, () => {
          chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
          chrome.runtime.sendMessage({ type: 'OASIS_OPEN_ADD_SURGERY', payload });
        });
      } else {
        chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
        chrome.runtime.sendMessage({ type: 'OASIS_OPEN_ADD_SURGERY', payload });
      }
    };

    // Chèn nút vào ngay cạnh text "Loại bệnh án: ..."
    // Gắn vào matchingElement để nó nằm ngang hàng với text
    matchingElement.appendChild(btn);
  }
}

// Inject CSS cho hiệu ứng nhấp nháy
const style = document.createElement('style');
style.textContent = `
  @keyframes oasisPulse {
    0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7); }
    70% { box-shadow: 0 0 0 6px rgba(245, 158, 11, 0); }
    100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
  }
`;
document.head.appendChild(style);

// Quan sát DOM thay đổi để inject nút khi user chuyển trang / filter
const observer = new MutationObserver(() => {
  injectScheduleButtons();
});
observer.observe(document.body, { childList: true, subtree: true });

// Lần chạy đầu tiên
setTimeout(injectScheduleButtons, 2000);
