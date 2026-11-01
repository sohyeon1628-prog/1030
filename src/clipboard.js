// 링크 복사. Safari(특히 iOS)는 비보안 주소(http://IP)에서 navigator.clipboard가 없고, execCommand는 보이는 요소를 선택해 줘야 하며
// 사용자 누름 직후(await 전)에 불러야 한다. 그래서 클립보드 API가 없을 때는 기다리지 않고 바로 대체 방법을 쓴다.
function legacyCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text; ta.setAttribute("readonly", ""); ta.setAttribute("aria-hidden", "true");
  ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px";   // 16px 미만이면 iOS가 확대한다
  document.body.appendChild(ta);
  let ok = false;
  try { ta.focus({ preventScroll: true }); ta.select(); ta.setSelectionRange(0, text.length); ok = document.execCommand("copy"); } catch { /* 복사 불가 */ }
  ta.remove();
  return ok;
}

export async function copyText(text) {
  if (!(navigator.clipboard?.writeText && window.isSecureContext)) return legacyCopy(text);
  try { await navigator.clipboard.writeText(text); return true; } catch { return legacyCopy(text); }
}
