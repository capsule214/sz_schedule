import { useEffect, useState } from 'react';
import { apiJson } from '../lib/api';

const qualificationCellStyle = { padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 13 };

export default function SerialScheduleQaArea({
  kisyuId,
  taskId,
  workerId,
  teacherId,
  sectionStyle,
  sectionTitleStyle,
  onBlockReasonChange,
}) {
  const [qualificationStatus, setQualificationStatus] = useState({ qualifications: [], skillLevel: 0, skillLevelName: 'なし' });
  const [qualificationLoading, setQualificationLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!kisyuId || !taskId || !workerId) {
      setQualificationStatus({ qualifications: [], skillLevel: 0, skillLevelName: 'なし' });
      setQualificationLoading(false);
      return () => { cancelled = true; };
    }

    setQualificationLoading(true);
    const params = new URLSearchParams({
      kisyu_id: String(kisyuId),
      task_id: String(taskId),
      worker_id: String(workerId),
    });
    apiJson(`/qualification/status?${params.toString()}`)
      .then(data => {
        if (cancelled) return;
        setQualificationStatus({
          qualifications: Array.isArray(data?.qualifications) ? data.qualifications : [],
          skillLevel: Number(data?.skillLevel || 0),
          skillLevelName: data?.skillLevelName || 'なし',
        });
      })
      .catch(() => {
        if (!cancelled) {
          setQualificationStatus({ qualifications: [], skillLevel: 0, skillLevelName: 'なし' });
        }
      })
      .finally(() => {
        if (!cancelled) setQualificationLoading(false);
      });

    return () => { cancelled = true; };
  }, [kisyuId, taskId, workerId]);

  function getBlockReason() {
    if (!workerId) return '';
    if (!kisyuId || !taskId) return '';
    if (qualificationLoading) return '資格・スキル確認中です';
    if (qualificationStatus.qualifications.length === 0) return '';
    if (qualificationStatus.skillLevel <= 0) return '有資格者を選択してください';
    if (qualificationStatus.skillLevel < 2 && !teacherId) return '教育者を選択してください';
    return '';
  }

  const blockReason = getBlockReason();

  useEffect(() => {
    onBlockReasonChange?.(blockReason);
  }, [blockReason, onBlockReasonChange]);

  return (
    <div style={sectionStyle}>
      <h3 style={sectionTitleStyle}>資格・スキル</h3>
      {qualificationLoading ? (
        <div style={{ fontSize: 13, color: '#6b7280' }}>取得中...</div>
      ) : (
        <>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
            {qualificationStatus.qualifications.length === 0 ? (
              <div style={{ ...qualificationCellStyle, borderBottom: 'none', color: '#6b7280' }}>必要資格なし</div>
            ) : qualificationStatus.qualifications.map(q => (
              <div key={q.qualificationId} style={{ display: 'grid', gridTemplateColumns: '1fr 58px' }}>
                <div style={qualificationCellStyle}>{q.qualificationName}</div>
                <div style={{ ...qualificationCellStyle, textAlign: 'center', color: q.hasSkill ? '#047857' : '#b91c1c', fontWeight: 700 }}>
                  {q.hasSkill ? 'あり' : 'なし'}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: 13, color: '#374151', fontWeight: 700 }}>
            スキルレベル:{qualificationStatus.skillLevelName}
          </div>
          {blockReason && (
            <div style={{ marginTop: 8, fontSize: 13, color: '#b91c1c', fontWeight: 700 }}>
              {blockReason}
            </div>
          )}
        </>
      )}
    </div>
  );
}
