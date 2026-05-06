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
    console.log('[OASIS] Received reverse navigation request for Mã BA:', maBA);
    // VNPT HIS typically has a global search input or specific form inputs for Mã BA.
    // Thường ô nhập mã bệnh án có id/name liên quan đến 'maBenhAn'
    const searchInput = document.querySelector('input[name*="maBenhAn"], input[id*="maBenhAn"], input[placeholder*="Mã bệnh án"]');
    const searchBtn = document.querySelector('button[id*="btnSearch"]') ||
      Array.from(document.querySelectorAll('button')).find(btn => btn.textContent.includes('Tìm kiếm')) ||
      document.querySelector('.btn-primary');
    
    if (searchInput) {
      searchInput.value = maBA;
      // Kích hoạt sự kiện change/input để React/Angular (nếu có) nhận diện thay đổi
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      
      if (searchBtn) {
        searchBtn.click();
      } else {
        // Fallback: Gửi phím Enter
        searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
      }
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

  const nameMatch = bannerText.match(/(?:^|\n)\s*(\d{8,12})\s*\|\s*([^|]+)\s*\|/);
  if (nameMatch) {
    maBA = nameMatch[1].trim();
    hoTen = nameMatch[2].trim();
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

  return { maBA, hoTen, chanDoan, benhKemTheo, ngayNhapVien };
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

// Inject "Lên lịch mổ" (Schedule Surgery) button into HIS UI
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
    btn.innerHTML = '📅 Lên lịch mổ';
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
      btn.title = `⚠️ Hôm nay đã có ${totalToday} ca mổ. Cân nhắc chuyển sang ngày mai.`;
    } else {
      btn.title = 'Chuyển thông tin bệnh nhân này sang OASIS để lên lịch mổ';
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

      const apiData = await fetchDiagnosisFromAPI();
      
      let finalDiagnosis = '';
      if (apiData && (apiData.cd || apiData.bkt)) {
        finalDiagnosis = appendUniqueParts(apiData.cd || '', [apiData.bkt || '']);
      } else {
        finalDiagnosis = currentData.chanDoan || initialData.chanDoan;
      }

      btn.innerHTML = originalText;
      const clickIsSurgical = surgicalKeywords.some(kw => finalDiagnosis.toLowerCase().includes(kw));
      
      const payload = {
        patient_id: clickMaBA,
        patient_name: clickHoTen,
        diagnosis: finalDiagnosis,
        admission_date: clickNgayNhapVien || null,
        priority: clickIsSurgical ? 'urgent' : 'elective'
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
