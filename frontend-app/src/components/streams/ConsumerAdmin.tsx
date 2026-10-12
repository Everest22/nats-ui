import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { api } from '../../lib/api'
import type { ConsumerConfigRequest } from '../../types'
import { Section, Row, Input, Select, NumberInput, Toggle, textareaStyle } from './StreamAdmin'

interface ConsumerAdminProps {
  connectionId: string
  /** Fixed stream (stream detail view / edit). When omitted, the user picks from streamNames. */
  streamName?: string
  streamNames?: string[]
  /** Set to edit an existing consumer; omit to create. */
  editConsumer?: string
  onClose: () => void
  onSaved: () => void
}

const defaultConsumer = (): ConsumerConfigRequest => ({
  name: '',
  description: '',
  filterSubjects: [],
  deliverPolicy: 'all',
  startSeq: 1,
  startTime: '',
  ackPolicy: 'explicit',
  ackWait: 30,
  maxDeliver: -1,
  maxAckPending: 1000,
  replayPolicy: 'instant',
  maxWaiting: 512,
  inactiveThreshold: 0,
  deliverSubject: '',
  deliverGroup: '',
  headersOnly: false,
  metadata: {},
})

export function ConsumerAdmin({ connectionId, streamName, streamNames = [], editConsumer, onClose, onSaved }: ConsumerAdminProps) {
  const isCreate = !editConsumer
  const [stream, setStream] = useState(streamName ?? streamNames[0] ?? '')
  const [config, setConfig] = useState<ConsumerConfigRequest>(defaultConsumer())
  const [kind, setKind] = useState<'pull' | 'push'>('pull')
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(isCreate)
  const [error, setError] = useState('')

  const set = (patch: Partial<ConsumerConfigRequest>) => setConfig(c => ({ ...c, ...patch }))

  useEffect(() => {
    if (!editConsumer || !streamName) return
    api.getConsumerConfig(connectionId, streamName, editConsumer)
      .then(c => {
        setConfig({ ...defaultConsumer(), ...c, filterSubjects: c.filterSubjects ?? [], metadata: c.metadata ?? {} })
        setKind(c.deliverSubject ? 'push' : 'pull')
        setLoaded(true)
      })
      .catch(e => setError(e.message))
  }, [])

  const submit = async () => {
    setError('')
    if (isCreate) {
      if (!stream) { setError('Select a stream'); return }
      if (!config.name.trim()) { setError('Consumer name is required'); return }
      if (kind === 'push' && !config.deliverSubject.trim()) { setError('Deliver subject is required for push consumers'); return }
      if (config.deliverPolicy === 'by_start_time' && !config.startTime) { setError('Start time is required'); return }
    }
    const body: ConsumerConfigRequest = {
      ...config,
      deliverSubject: kind === 'push' ? config.deliverSubject : '',
      deliverGroup: kind === 'push' ? config.deliverGroup : '',
      startTime: config.startTime ? new Date(config.startTime).toISOString() : '',
    }
    setLoading(true)
    try {
      if (isCreate) await api.createConsumer(connectionId, stream, body)
      else await api.editConsumer(connectionId, stream, editConsumer!, body)
      onSaved()
      onClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const filtersText = config.filterSubjects.join('\n')

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--bg-surface)', borderRadius: '12px', width: '92%', maxWidth: '760px',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>
            {isCreate ? 'Create Consumer' : `Edit Consumer: ${editConsumer}`}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: '4px', display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {!loaded ? (
            <p style={{ fontSize: '13px', color: error ? 'var(--red)' : 'var(--text-dim)' }}>{error || 'Loading…'}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
              <Section title="Basic">
                <Row label="Stream" required={isCreate}>
                  {streamName
                    ? <Input value={streamName} onChange={() => {}} disabled mono />
                    : <Select value={stream} onChange={setStream} options={streamNames.map(n => [n, n] as [string, string])} />}
                </Row>
                <Row label="Name" required={isCreate} hint="Durable name. Cannot be changed later.">
                  <Input value={config.name} onChange={v => set({ name: v })} disabled={!isCreate} placeholder="e.g. order-processor" mono />
                </Row>
                <Row label="Description">
                  <Input value={config.description} onChange={v => set({ description: v })} placeholder="Optional description" />
                </Row>
                <Row label="Type" note={!isCreate ? 'Cannot be changed after creation' : undefined}>
                  <Select value={kind} onChange={v => setKind(v as 'pull' | 'push')} disabled={!isCreate}
                    options={[['pull', 'Pull'], ['push', 'Push']]} />
                </Row>
                {kind === 'push' && (
                  <>
                    <Row label="Deliver Subject" required={isCreate} hint="Subject messages are pushed to">
                      <Input value={config.deliverSubject} onChange={v => set({ deliverSubject: v })} disabled={!isCreate} mono />
                    </Row>
                    <Row label="Deliver Group" hint="Queue group for load balancing">
                      <Input value={config.deliverGroup} onChange={v => set({ deliverGroup: v })} disabled={!isCreate} mono />
                    </Row>
                  </>
                )}
                <Row label="Filter Subjects" hint="One per line. Empty = all subjects in the stream.">
                  <textarea value={filtersText} rows={3} placeholder="orders.created"
                    onChange={e => set({ filterSubjects: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })}
                    style={textareaStyle} />
                </Row>
              </Section>

              <Section title="Delivery">
                <Row label="Deliver Policy" note={!isCreate ? 'Cannot be changed after creation' : undefined}>
                  <Select value={config.deliverPolicy} onChange={v => set({ deliverPolicy: v })} disabled={!isCreate}
                    options={[
                      ['all', 'All'], ['last', 'Last'], ['new', 'New'], ['last_per_subject', 'Last per subject'],
                      ['by_start_sequence', 'By start sequence'], ['by_start_time', 'By start time'],
                    ]} />
                </Row>
                {config.deliverPolicy === 'by_start_sequence' && (
                  <Row label="Start Sequence">
                    <NumberInput value={config.startSeq} min={1} onChange={v => set({ startSeq: v })} disabled={!isCreate} />
                  </Row>
                )}
                {config.deliverPolicy === 'by_start_time' && (
                  <Row label="Start Time">
                    <input type="datetime-local" disabled={!isCreate}
                      value={config.startTime ? config.startTime.slice(0, 16) : ''}
                      onChange={e => set({ startTime: e.target.value })}
                      style={{ padding: '7px 11px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px' }} />
                  </Row>
                )}
                <Row label="Replay Policy">
                  <Select value={config.replayPolicy} onChange={v => set({ replayPolicy: v })}
                    options={[['instant', 'Instant'], ['original', 'Original (replay at original rate)']]} />
                </Row>
                <Row label="Headers Only">
                  <Toggle checked={config.headersOnly} onChange={v => set({ headersOnly: v })} disabled={!isCreate} />
                </Row>
              </Section>

              <Section title="Acknowledgement & Limits">
                <Row label="Ack Policy" note={!isCreate ? 'Cannot be changed after creation' : undefined}>
                  <Select value={config.ackPolicy} onChange={v => set({ ackPolicy: v })} disabled={!isCreate}
                    options={[['explicit', 'Explicit'], ['all', 'All'], ['none', 'None']]} />
                </Row>
                <Row label="Ack Wait (seconds)">
                  <NumberInput value={config.ackWait} min={0} onChange={v => set({ ackWait: v })} />
                </Row>
                <Row label="Max Deliver" hint="-1 = unlimited">
                  <NumberInput value={config.maxDeliver} min={-1} onChange={v => set({ maxDeliver: v })} />
                </Row>
                <Row label="Max Ack Pending" hint="-1 = unlimited">
                  <NumberInput value={config.maxAckPending} min={-1} onChange={v => set({ maxAckPending: v })} />
                </Row>
                {kind === 'pull' && (
                  <Row label="Max Waiting" hint="Max outstanding pull requests">
                    <NumberInput value={config.maxWaiting} min={0} onChange={v => set({ maxWaiting: v })} />
                  </Row>
                )}
                <Row label="Inactive Threshold (seconds)" hint="Auto-delete after this much inactivity. 0 = never.">
                  <NumberInput value={config.inactiveThreshold} min={0} onChange={v => set({ inactiveThreshold: v })} />
                </Row>
              </Section>

              {error && <div style={{ fontSize: '12px', color: 'var(--red)' }}>{error}</div>}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={submit} disabled={loading} style={{
                  padding: '9px 18px', borderRadius: '7px', background: 'var(--accent)', border: 'none',
                  color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 500,
                  opacity: loading ? 0.6 : 1,
                }}>{loading ? 'Saving…' : isCreate ? 'Create Consumer' : 'Save Changes'}</button>
                <button onClick={onClose} style={{
                  padding: '9px 18px', borderRadius: '7px', background: 'none', border: '1px solid var(--border)',
                  color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px',
                }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
