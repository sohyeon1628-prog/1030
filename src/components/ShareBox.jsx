import React, { useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { copyText } from "../clipboard.js";

// 편지를 링크로 올린 결과: 올리는 중 / 링크(복사·공유, 여러 사람이면 사람마다 한 줄) / 실패(다시 올리기)
export default function ShareBox({ share, onRetry }) {
  if (!share) return null;

  if (share.status === "sending") return <div className="sharebox"><div className="dots-loading" aria-label="편지를 올리는 중"><span /><span /><span /></div></div>;
  if (share.status === "error") {
    return (
      <div className="sharebox error" role="alert">
        <p>{share.code === 429 ? "한 시간에 보낼 수 있는 편지를 다 썼어요. 잠시 뒤에 다시 올려 주세요." : "서버에 닿지 못했어요. 편지는 편지함에 있어요."}</p>
        <button className="btn" onClick={onRetry}><Icon name="send" size={18} /> 다시 올리기</button>
      </div>
    );
  }
  const links = share.links || [];
  if (links.length > 1) return <div className="share-list">{links.map((l) => <LinkRow key={l.url} to={l.to} url={l.url} />)}</div>;
  return links[0] ? <LinkRow url={links[0].url} /> : null;
}

// 링크 한 줄: 링크 칸, 복사, (지원하면) 공유. 여러 사람이면 앞에 받는 사람 이름이 붙는다.
function LinkRow({ to, url }) {
  const input = useRef(null);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const copy = async () => {
    const ok = await copyText(url);
    if (!ok) { const el = input.current; el?.focus(); el?.setSelectionRange?.(0, url.length); }   // 복사하지 못하면 링크를 선택해 두어 직접 복사하게 한다
    setFailed(!ok); setCopied(ok); setTimeout(() => { setCopied(false); setFailed(false); }, 2400);
  };
  const canShare = typeof navigator !== "undefined" && !!navigator.share && (!navigator.canShare || navigator.canShare({ url }));
  return (
    <div className="sharebox">
      {to && <span className="who">{to}</span>}
      <input ref={input} readOnly value={url} onFocus={(e) => e.target.select()} aria-label={to ? `${to}에게 보낼 링크` : "편지 링크"} />
      <button className={`icon-act ${copied ? "ok" : ""}`} onClick={copy} aria-label="링크 복사" title="링크 복사"><Icon name={copied ? "check" : "copy"} size={20} /></button>
      {failed && <span className="who" role="status">링크를 길게 눌러 복사하세요</span>}
      {canShare && <button className="icon-act" onClick={() => navigator.share({ title: "나루 우체국", text: to ? `${to}에게 편지가 왔어요` : undefined, url }).catch(() => {})} aria-label="공유" title="공유"><Icon name="share" size={20} /></button>}
    </div>
  );
}
