import React from "react";

// 글자 대신 쓰는 둥근 아이콘 모음 (24x24, currentColor). 메인 화면의 핀과 버튼에 쓴다.
const S = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };

export const RELATION_ICON = { 어머니: "flower", 아버지: "tree", 친구: "people", 연인: "heart", 은사: "book", 형제자매: "people", 형제: "people", 자녀: "heart", 딸: "heart", 반려동물: "paw" };

export default function Icon({ name, size = 24 }) {
  const body = {
    heart: <path d="M12 21s-7-4.6-9.2-9.1C1.3 8.6 3 5 6.5 5c2 0 3.5 1.2 5.5 3.2C14 6.2 15.5 5 17.5 5 21 5 22.7 8.6 21.2 11.9 19 16.4 12 21 12 21z" />,
    star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
    flower: <g><circle cx="12" cy="6.2" r="3" /><circle cx="17.6" cy="10.2" r="3" /><circle cx="15.4" cy="16.6" r="3" /><circle cx="8.6" cy="16.6" r="3" /><circle cx="6.4" cy="10.2" r="3" /><circle cx="12" cy="12" r="2.6" fill="#ffd166" /></g>,
    tree: <g><circle cx="12" cy="9" r="6.5" /><rect x="10.8" y="13" width="2.4" height="8" rx="1.2" /></g>,
    people: <g><circle cx="8" cy="8" r="3.2" /><circle cx="16.4" cy="9" r="2.7" /><path d="M2.5 19.5c0-3.2 2.5-5.3 5.5-5.3s5.5 2.1 5.5 5.3z" /><path d="M14.2 19.5c0-2.5 1.6-4.2 3.9-4.2 2.4 0 3.9 1.7 3.9 4.2z" /></g>,
    book: <g><path d="M3.5 5.5C3.5 4.7 4.2 4 5 4h6.2v15H5c-.8 0-1.5-.7-1.5-1.5z" /><path d="M12.8 4H19c.8 0 1.5.7 1.5 1.5v12c0 .8-.7 1.5-1.5 1.5h-6.2z" /></g>,
    paw: <g><ellipse cx="6.5" cy="10.5" rx="2" ry="2.6" /><ellipse cx="10.2" cy="6.5" rx="2" ry="2.6" /><ellipse cx="14.2" cy="6.5" rx="2" ry="2.6" /><ellipse cx="17.8" cy="10.5" rx="2" ry="2.6" /><path d="M12.2 11.5c3 0 5.5 2.7 5.5 5.2 0 2.2-1.9 3-3.4 2.4-1-.4-1.4-.6-2.1-.6s-1.1.2-2.1.6c-1.5.6-3.4-.2-3.4-2.4 0-2.5 2.5-5.2 5.5-5.2z" /></g>,
    mail: <g {...S}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3.8 7.5l8.2 6 8.2-6" /></g>,
    pen: <g {...S}><path d="M4 20l1.2-4.6L16.5 4.1a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z" /><path d="M14.5 6.2l3.3 3.3" /></g>,
    help: <g {...S}><circle cx="12" cy="12" r="9" /><path d="M9.6 9.4a2.6 2.6 0 1 1 3.7 2.3c-.9.4-1.3 1-1.3 1.9" /><circle cx="12" cy="17" r=".6" fill="currentColor" /></g>,
    sound: <g {...S}><path d="M4 9.5v5h3.6L12.5 18.5v-13L7.6 9.5z" fill="currentColor" /><path d="M16 9a4.2 4.2 0 0 1 0 6" /><path d="M18.5 6.5a8 8 0 0 1 0 11" /></g>,
    mute: <g {...S}><path d="M4 9.5v5h3.6L12.5 18.5v-13L7.6 9.5z" fill="currentColor" /><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" /></g>,
    lock: <g><rect x="5" y="10.5" width="14" height="10" rx="3" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></g>,
    link: <g {...S}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></g>,
    copy: <g {...S}><rect x="9" y="9" width="11" height="11" rx="3" /><path d="M15 9V6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15H9" /></g>,
    share: <g {...S}><circle cx="6" cy="12" r="2.6" /><circle cx="17.5" cy="6" r="2.6" /><circle cx="17.5" cy="18" r="2.6" /><path d="M8.3 10.8l7-3.6M8.3 13.2l7 3.6" /></g>,
    trash: <g {...S}><path d="M4.5 7h15" /><path d="M9.5 7V5A1.5 1.5 0 0 1 11 3.5h2A1.5 1.5 0 0 1 14.5 5v2" /><path d="M6.5 7l.8 12a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-12" /></g>,
    eye: <g {...S}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></g>,
    send: <g {...S}><path d="M21 3L10 14" /><path d="M21 3l-7 18-4-7-7-4z" /></g>,
    mic: <g {...S}><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" /></g>,
    stop: <rect x="6" y="6" width="12" height="12" rx="2.5" />,
    play: <path d="M8 5.5v13l11-6.5z" />,
    close: <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />,
    party: <g {...S}><path d="M4 20l4.5-11.5L15.5 15.5z" /><path d="M13 5l.6 1.6M19 9l-1.6.6M16 3.5v1.8M20 14l-1.8-.3" /></g>,
    up: <path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />,
    down: <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />,
    orb: <circle cx="12" cy="12" r="6" />,
    check: <path d="M5 12.8l4.4 4.4L19 7.6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />,
  }[name] || null;
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" focusable="false">{body}</svg>;
}
