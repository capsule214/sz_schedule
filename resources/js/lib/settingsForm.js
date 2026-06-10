import { useState, useCallback } from 'react';

/**
 * API / Cookie から渡される settings オブジェクトを正規化する純粋関数。
 * undefined / null / 型違いを吸収し、常に一定の shape を返す。
 */
export function normalizeSettings(s = {}) {
  const no = Number(s.settingNo ?? 0);
  return {
    settingNo:      no,
    settingName:    (s.settingName || '').trim() || `表示設定${no + 1}`,
    // 装置タブ
    duration:       Math.max(1, Number(s.duration      ?? 1)),
    sborder:        Number(s.sborder       ?? 0),
    sbcolor:        Number(s.sbcolor       ?? 0),
    sbsbmb:         Number(s.sbsbmb        ?? 0),
    sbequiptype:    Number(s.sbequiptype   ?? -1),
    sbstatuslist:   (s.sbstatuslist   || []).map(Number),
    sbinchargelist: (s.sbinchargelist || []).map(String),
    sbszgrouplist:  (s.sbszgrouplist  || []).map(Number),
    sbmodellist:    (s.sbmodellist    || []).map(Number),
    // 担当者タブ
    sycolor:        Number(s.sycolor       ?? 0),
    sygroup:        Number(s.sygroup       ?? 0),
    syteamlist:     (s.syteamlist  || []).map(Number),
    sytasklist:     (s.sytasklist  || []).map(Number),
    // タスクタブ
    tksbmb:         Number(s.tksbmb        ?? 0),
    tktasklist:     (s.tktasklist  || []).map(Number),
    // DPR タブ
    dprduration:           Math.max(1, Number(s.dprduration           ?? 4)),
    dprorder:              Number(s.dprorder              ?? 0),
    dprcolor:              Number(s.dprcolor              ?? 0),
    dprflgseiban:          !!s.dprflgseiban,
    dprmodellist:          (s.dprmodellist           || []).map(String),
    dprsaleslocationlist:  (s.dprsaleslocationlist   || []).map(String),
    dprpublicationyearlist:(s.dprpublicationyearlist || []).map(String),
    dprdeliverytypelist:   (s.dprdeliverytypelist    || []).map(Number),
    dprformtypelist:       (s.dprformtypelist        || []).map(Number),
    dprclassificationlist: (s.dprclassificationlist  || []).map(String),
    dprstatuslist:         (s.dprstatuslist          || []).map(String),
    dprinchargelist:       (s.dprinchargelist        || []).map(String),
    dprszgrouplist:        (s.dprszgrouplist         || []).map(String),
    // 表示オプション2（全タブ共通）
    sboption:       !!s.sboption,
    synobody:       !!s.synobody,
    sbdspplplan:    !!s.sbdspplplan,
    sbdspdate:      !!s.sbdspdate,
    sbdspincharge:  !!s.sbdspincharge,
    flgsyoyo:       !!s.flgsyoyo,
    flgukeoi:       !!s.flgukeoi,
    flgkeppin:      !!s.flgkeppin,
    flggoso:        !!s.flggoso,
    flgdiff:        !!s.flgdiff,
  };
}

/**
 * 表示設定フォームの状態管理カスタムフック。
 *
 * @returns {{ form, setField, applySettings }}
 *   - form         正規化済みの設定オブジェクト
 *   - setField     特定フィールドを更新する (key, value) => void
 *   - applySettings 外部設定オブジェクトを丸ごと適用する (s) => void
 */
export function useSettingsForm(initial) {
  const [form, setForm] = useState(() => normalizeSettings(initial));

  const setField = useCallback(
    (key, value) => setForm(prev => ({ ...prev, [key]: value })),
    [],
  );

  const applySettings = useCallback(
    (s) => setForm(normalizeSettings(s)),
    [],
  );

  return { form, setField, applySettings };
}
