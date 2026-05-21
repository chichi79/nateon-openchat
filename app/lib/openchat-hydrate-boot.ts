import { openchatPageLoadingCopy } from '@/components/openchat-page-loading'
import { isRoomChatDetailPath } from '@/lib/openchat-room-path'

import { OPENCHAT_THEME_COLORS, type OpenchatTheme } from '@/lib/openchat-theme-tokens'

/** SPA 정적 index.html — React/CSS 전 동기 보정(채팅방 F5 검정 플래시 방지) */
export function openchatHydrateBootHelpersScript(): string {
  const { app, roomList, roomChat } = openchatPageLoadingCopy
  const { light, dark } = OPENCHAT_THEME_COLORS

  return [
    'function ocIsRoomChat(p){if(!p.startsWith("/rooms/"))return false;var s=p.slice(7).split("/")[0];return!!s&&s!=="new";}',
    `function ocThemeColors(t){var L=t==="light";return{bg:L?${JSON.stringify(light.bg)}:${JSON.stringify(dark.bg)},fg:L?${JSON.stringify(light.text)}:${JSON.stringify(dark.text)},chat:L?${JSON.stringify(light.chatPanel)}:${JSON.stringify(dark.chatPanel)}};}`,
    'function ocSurfaceBg(t,p){var c=ocThemeColors(t);return ocIsRoomChat(p)?c.chat:c.bg;}',
    'function ocApplyRootPaint(t,p){var c=ocThemeColors(t),surface=ocSurfaceBg(t,p);document.documentElement.style.colorScheme=t;document.documentElement.setAttribute("data-theme",t);document.documentElement.style.backgroundColor=surface;document.documentElement.style.color=c.fg;if(document.body){document.body.style.backgroundColor=surface;document.body.style.color=c.fg;}}',
    'function ocSyncHydrateShell(t,p){var c=ocThemeColors(t),surface=ocSurfaceBg(t,p),chat=ocIsRoomChat(p);var lay=document.querySelector(".openchat-hydrate-layout");if(lay){lay.style.backgroundColor=surface;lay.style.color=c.fg;}',
    'var shell=document.querySelector(".openchat-page-loading-shell");if(shell){shell.classList.remove("openchat-page-loading-shell--page","openchat-page-loading-shell--chat");shell.classList.add(chat?"openchat-page-loading-shell--chat":"openchat-page-loading-shell--page");shell.style.backgroundColor=surface;shell.style.color=c.fg;}}',
    'function ocSyncHydrateLoadingCopy(){',
    `var aT=${JSON.stringify(app.title)};var aH=${JSON.stringify(app.hint ?? '')};`,
    `var rT=${JSON.stringify(roomList.title)};var rH=${JSON.stringify(roomList.hint ?? '')};`,
    `var cT=${JSON.stringify(roomChat.title)};var cH=${JSON.stringify(roomChat.hint ?? '')};`,
    'var p=location.pathname,title=aT,hint=aH;',
    'if(p==="/rooms"){title=rT;hint=rH;}else if(ocIsRoomChat(p)){title=cT;hint=cH;}',
    'var el=document.querySelector(".openchat-page-loading-title");if(el)el.textContent=title;',
    'var hi=document.querySelector(".openchat-page-loading-hint");if(hi)hi.textContent=hint;',
    '}',
    `function ocBootCss(t,p){var c=ocThemeColors(t),bg=c.bg,fg=c.fg,chat=c.chat,surface=ocSurfaceBg(t,p);return 'html,body{background-color:'+surface+'!important;color:'+fg+'!important;min-height:100%;min-height:100dvh;}.openchat-hydrate-layout{background-color:'+surface+'!important;color:'+fg+'!important;min-height:100dvh;}.openchat-page-loading-shell--page{background-color:'+bg+'!important;color:'+fg+'!important;}.openchat-page-loading-shell--chat{background-color:'+chat+'!important;color:'+fg+'!important;}.openchat-page-loading-shell{background-color:'+surface+'!important;color:'+fg+'!important;}';}`,
    'function ocBootStyle(t,p){var el=document.getElementById("openchat-theme-boot");if(!el){el=document.createElement("style");el.id="openchat-theme-boot";document.head.appendChild(el);}el.textContent=ocBootCss(t,p);}',
  ].join('')
}

export function openchatHydrateBootRunScript(storageKey: string): string {
  return [
    'try{',
    `var k=${JSON.stringify(storageKey)};`,
    "var s=localStorage.getItem(k);",
    "var t=s==='light'||s==='dark'?s:'dark';",
    'var p=location.pathname;',
    "document.documentElement.setAttribute('data-openchat-path',p);",
    'ocApplyRootPaint(t,p);',
    'ocBootStyle(t,p);',
    'ocSyncHydrateLoadingCopy();',
    'ocSyncHydrateShell(t,p);',
    '}catch(e){',
    "var p=location.pathname;",
    "ocApplyRootPaint('dark',p);",
    "ocBootStyle('dark',p);",
    'ocSyncHydrateLoadingCopy();',
    'ocSyncHydrateShell("dark",p);',
    '}',
  ].join('')
}

/** TS — 테스트·문서용 */
export function hydrateSurfaceBg(theme: OpenchatTheme, pathname: string) {
  return isRoomChatDetailPath(pathname) ? OPENCHAT_THEME_COLORS[theme].chatPanel : OPENCHAT_THEME_COLORS[theme].bg
}
