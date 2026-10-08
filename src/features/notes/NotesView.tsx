import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Avatar } from '../../components/Avatar'
import { ContextMenu, useContextMenu, type ContextAction } from '../../components/ContextMenu'
import { Icon } from '../../components/Icon'
import { renderRichText } from '../../components/RichText'
import { UnsavedChangesBar } from '../../components/UnsavedChangesBar'
import { usePreferences } from '../../state/PreferencesContext'
import { useSpaces } from '../../state/SpacesContext'
import { useAppDialog } from '../../components/AppDialog'
import type { WorkspaceNote, WorkspaceNoteComment } from '../../types/spaces'
import { timeAgo } from '../../utils/format'
import { filterContent } from '../../utils/content-filter'
import { hasWorkspacePermission } from '../../utils/permissions'

const MAX_TXT_BYTES = 256 * 1024

export function NotesView() {
  const dialog = useAppDialog()
  const { data, activeChannel, activeChannelId, profile, saveNote, deleteNote, addComment, editComment, deleteComment, pushToast } = useSpaces()
  const { preferences } = usePreferences()
  const contextMenu = useContextMenu()
  const commentMenu = useContextMenu()
  const importInput = useRef<HTMLInputElement>(null)
  const replaceInput = useRef<HTMLInputElement>(null)
  const [replaceTargetId, setReplaceTargetId] = useState('')
  const notes = useMemo(() => (data?.notes ?? []).filter(note => note.channelId === activeChannelId).sort((a, b) => b.updatedAt - a.updatedAt), [activeChannelId, data?.notes])
  const [selectedId, setSelectedId] = useState('')
  const [creating, setCreating] = useState(false)
  const selected = creating ? null : (notes.find(note => note.id === selectedId) ?? null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editCommentBody, setEditCommentBody] = useState('')
  const [expandedThreads, setExpandedThreads] = useState<string[]>([])

  useEffect(() => {
    if (creating) return
    if (!selectedId && notes[0]) setSelectedId(notes[0].id)
    if (selectedId && !notes.some(note => note.id === selectedId)) setSelectedId(notes[0]?.id ?? '')
  }, [creating, notes, selectedId])
  useEffect(() => { setCreating(false); setSelectedId(''); setCommentsOpen(false); setReplyToCommentId(null) }, [activeChannelId])
  useEffect(() => { setTitle(selected?.title ?? ''); setBody(selected?.body ?? ''); setReplyToCommentId(null); setEditingCommentId(null) }, [selected?.id])

  const comments = useMemo(() => (data?.comments ?? []).filter(item => item.noteId === selectedId && !item.deletedAt).sort((a, b) => a.createdAt - b.createdAt), [data?.comments, selectedId])
  const topComments = comments.filter(item => !item.parentCommentId)
  const repliesFor = (id: string) => comments.filter(item => item.parentCommentId === id)
  const canCreate = activeChannel?.effectivePermissions?.create_notes ?? hasWorkspacePermission(data, profile?.id, 'edit_notes')
  const canEdit = activeChannel?.effectivePermissions?.edit_notes ?? hasWorkspacePermission(data, profile?.id, 'edit_notes')
  const canDelete = activeChannel?.effectivePermissions?.delete_notes ?? hasWorkspacePermission(data, profile?.id, 'delete_notes')
  const canModerate = hasWorkspacePermission(data, profile?.id, 'moderate_comments')
  const dirty = Boolean(selected ? title !== selected.title || body !== selected.body : title || body)

  async function confirmLeaveDirty() {
    if (!dirty) return true
    return dialog.confirm({ title: 'You have unsaved changes', message: 'Reset the current note changes before switching notes.', confirmText: 'Reset and Continue', cancelText: 'Keep Editing' })
  }
  async function openNote(note: WorkspaceNote) {
    if (selected?.id === note.id) return
    if (!await confirmLeaveDirty()) return
    setCreating(false); setSelectedId(note.id)
  }
  async function save(reason?: string) {
    if (!(selected ? canEdit : canCreate) || !activeChannelId || !title.trim()) return
    setSaving(true)
    try {
      const saved = await saveNote({ id: selected?.id ?? '', channelId: activeChannelId, title: title.trim(), body }, reason ?? (selected ? 'Updated from Spaces' : 'Created from Spaces'))
      if (saved) { setCreating(false); setSelectedId(saved.id); setTitle(saved.title); setBody(saved.body) }
    } finally { setSaving(false) }
  }
  function resetNoteChanges() { setTitle(selected?.title ?? ''); setBody(selected?.body ?? '') }
  async function newNote() {
    if (!canCreate || !await confirmLeaveDirty()) return
    setCreating(true); setSelectedId(''); setTitle(''); setBody(''); setComment(''); setCommentsOpen(false)
  }
  async function removeNote(note: WorkspaceNote) {
    if (!canDelete || !await dialog.confirm({ title: `Delete “${note.title}”?`, message: 'This shared note will be removed for everyone in the Space.', confirmText: 'Delete note', danger: true })) return
    await deleteNote(note.id); setCreating(false); setSelectedId('')
  }
  async function readTxt(file: File) {
    if (!file.name.toLowerCase().endsWith('.txt') && file.type !== 'text/plain') throw new Error('Choose a plain .txt file.')
    if (file.size > MAX_TXT_BYTES) throw new Error('Text imports are limited to 256 KB.')
    return file.text()
  }
  async function importTxt(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file || !canCreate || !activeChannelId) return
    try { const text = await readTxt(file); const nextTitle = file.name.replace(/\.txt$/i, '').trim().slice(0, 80) || 'Imported note'; const saved = await saveNote({ id: '', channelId: activeChannelId, title: nextTitle, body: text }, `Imported from ${file.name}`); if (saved) { setCreating(false); setSelectedId(saved.id) } }
    catch (error) { pushToast(error instanceof Error ? error.message : 'Could not import that text file.', 'danger') }
  }
  async function replaceFromTxt(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''; const target = notes.find(note => note.id === replaceTargetId); setReplaceTargetId('')
    if (!file || !target || !canEdit) return
    try { const text = await readTxt(file); const saved = await saveNote({ id: target.id, channelId: target.channelId, title: target.title, body: text }, `Updated from ${file.name}`); if (saved) { setCreating(false); setSelectedId(saved.id) } }
    catch (error) { pushToast(error instanceof Error ? error.message : 'Could not update that note.', 'danger') }
  }
  function beginReplace(note: WorkspaceNote) { if (!canEdit) return; setReplaceTargetId(note.id); window.setTimeout(() => replaceInput.current?.click(), 0) }
  function exportTxt(note: WorkspaceNote) {
    const safeName = note.title.replace(/[\/:*?"<>|]/g, '-').trim() || 'Spaces note'; const blob = new Blob([note.body], { type: 'text/plain;charset=utf-8' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${safeName}.txt`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url); pushToast('Note exported as .txt.', 'success')
  }
  function noteActions(note: WorkspaceNote): ContextAction[] { return [
    { id: 'open', label: 'Open note', note: `Edited ${timeAgo(note.updatedAt)}`, icon: 'notes', onSelect: () => void openNote(note) },
    { id: 'copy', label: 'Copy note text', note: note.title, icon: 'copy', onSelect: async () => { await navigator.clipboard.writeText(`${note.title}\n\n${note.body}`); pushToast('Note copied.', 'success') } },
    { id: 'export', label: 'Export .txt', note: 'Download this note as plain text', icon: 'download', onSelect: () => exportTxt(note) },
    ...(canEdit ? [{ id: 'replace-txt', label: 'Update from .txt', note: 'Replace this note body from a text file', icon: 'upload' as const, onSelect: () => beginReplace(note) }] : []),
    ...(canCreate ? [{ id: 'duplicate', label: 'Duplicate note', note: 'Create a copy in this channel', icon: 'copy' as const, onSelect: async () => { const duplicate = await saveNote({ id: '', channelId: note.channelId, title: `${note.title} copy`, body: note.body }, 'Duplicated note'); if (duplicate) { setCreating(false); setSelectedId(duplicate.id) } } }] : []),
    ...(canDelete ? [{ id: 'delete', label: 'Delete note', note: 'Remove this shared note', icon: 'trash' as const, danger: true, onSelect: () => removeNote(note) }] : []),
  ] }
  function commentActions(item: WorkspaceNoteComment): ContextAction[] {
    const own = item.authorId === profile?.id
    const postOwner = selected?.createdBy === profile?.id
    return [
      { id: 'reply', label: 'Reply', icon: 'reply', onSelect: () => { setReplyToCommentId(item.parentCommentId ?? item.id); setCommentsOpen(true) } },
      ...(own ? [{ id: 'edit', label: 'Edit comment', icon: 'edit' as const, onSelect: () => { setEditingCommentId(item.id); setEditCommentBody(item.body) } }] : []),
      ...((own || postOwner || canModerate) ? [{ id: 'delete', label: 'Delete comment', icon: 'trash' as const, danger: true, onSelect: () => deleteComment(item.id) }] : []),
    ]
  }
  async function submitComment() {
    if (!selected || !comment.trim()) return
    const body = comment.trim(); setComment('')
    try { await addComment(selected.id, body, replyToCommentId); setReplyToCommentId(null) }
    catch (error) { setComment(body); pushToast(error instanceof Error ? error.message : 'Comment failed.', 'danger') }
  }
  async function saveCommentEdit(item: WorkspaceNoteComment) {
    const value = editCommentBody.trim(); if (!value) return
    try { await editComment(item.id, value); setEditingCommentId(null); setEditCommentBody('') }
    catch (error) { pushToast(error instanceof Error ? error.message : 'Could not edit comment.', 'danger') }
  }
  function renderComment(item: WorkspaceNoteComment, reply = false) {
    const replies = reply ? [] : repliesFor(item.id)
    const expanded = expandedThreads.includes(item.id)
    return <div className={reply ? 'comment-reply-v70' : ''} key={item.id}>
      <article className="comment comment-v70" onContextMenu={event => { event.preventDefault(); commentMenu.open(item.authorName, commentActions(item), event.clientX, event.clientY, item.authorUsername ? `@${item.authorUsername}` : undefined) }}>
        <Avatar name={item.authorName} initials={item.authorInitials} src={item.authorAvatarUrl} size={30}/>
        <div className="comment-content-v70"><div className="comment-meta"><strong>{item.authorName}</strong>{item.authorUsername && <span>@{item.authorUsername}</span>}<time>{timeAgo(item.createdAt)}</time>{item.editedAt && <em>edited</em>}</div>
          {editingCommentId === item.id ? <div className="comment-edit-v70"><textarea value={editCommentBody} onChange={event => setEditCommentBody(event.target.value)} autoFocus/><div><button className="secondary-button compact" onClick={() => setEditingCommentId(null)}>Cancel</button><button className="primary-button compact" onClick={() => void saveCommentEdit(item)}>Save</button></div></div> : <p>{renderRichText(item.body, data?.emojis ?? [], preferences.contentFilter)}</p>}
        </div>
        <button className="comment-more-v70" title="Comment actions" onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); commentMenu.open(item.authorName, commentActions(item), rect.right, rect.bottom, item.authorUsername ? `@${item.authorUsername}` : undefined) }}><Icon name="more" size={14}/></button>
      </article>
      {replies.length > 0 && <><button className="comment-replies-toggle-v70" onClick={() => setExpandedThreads(current => current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id])}>{replies.length} {replies.length === 1 ? 'reply' : 'replies'} <Icon name="chevron" size={11}/></button>{expanded && <div className="comment-replies-v70">{replies.map(child => renderComment(child, true))}</div>}</>}
    </div>
  }

  if (!activeChannel) return <div className="center-empty"><Icon name="notes" /><h2>Select a note channel</h2></div>
  return <div className={`notes-view page-enter notes-view-v9 notes-view-v70 ${commentsOpen ? 'comments-open-v70' : ''}`}>
    <aside className="note-list-panel"><header><div><span className="eyebrow">SHARED NOTES</span><h2>#{activeChannel.name}</h2></div><div className="note-header-actions">{canCreate && <button className="icon-button" title="Import .txt" onClick={() => importInput.current?.click()}><Icon name="upload" size={15}/></button>}<button className="icon-button emphasized" disabled={!canCreate} title={canCreate ? 'New note' : 'Your roles cannot create notes'} onClick={() => void newNote()}><Icon name="plus" /></button></div><input ref={importInput} hidden type="file" accept=".txt,text/plain" onChange={event => void importTxt(event)}/><input ref={replaceInput} hidden type="file" accept=".txt,text/plain" onChange={event => void replaceFromTxt(event)}/></header>
      {canCreate && <div className="note-import-hint"><Icon name="paperclip" size={13}/><span>New note or import a .txt file</span></div>}
      <div className="note-list">{notes.map(note => { const count = (data?.comments ?? []).filter(item => item.noteId === note.id && !item.deletedAt).length; return <button {...contextMenu.bind(note.title, noteActions(note), 'Right-click or hold for note actions')} className={`note-list-item ${selected?.id === note.id ? 'active' : ''}`} key={note.id} onClick={() => void openNote(note)}><strong>{note.title}</strong><p>{filterContent(note.body, preferences.contentFilter).slice(0, 90) || 'Empty note'}</p><span>Edited {timeAgo(note.updatedAt)}{count > 0 ? ` · ${count} comment${count === 1 ? '' : 's'}` : ''}</span></button> })}{!notes.length && <div className="mini-empty"><Icon name="notes" /><span>No notes in this channel.</span></div>}</div>
    </aside>
    <section className="note-editor-panel"><div className="note-editor-toolbar"><span>{selected ? `v${selected.version}` : 'NEW NOTE'}</span><div className="note-editor-actions">{selected && <button className={`secondary-button compact ${commentsOpen ? 'active-v70' : ''}`} onClick={() => setCommentsOpen(value => !value)}><Icon name="chat" size={14}/> Comments{comments.length > 0 && <b className="comments-count-v70">{comments.length}</b>}</button>}{selected && <button className="secondary-button compact" onClick={() => exportTxt(selected)}><Icon name="download" size={14}/> Export</button>}{selected && canEdit && <button className="secondary-button compact" onClick={() => beginReplace(selected)}><Icon name="upload" size={14}/> Import update</button>}{selected && canDelete && <button className="ghost-danger" onClick={() => void removeNote(selected)}><Icon name="trash" size={15}/> Delete</button>}<button className="primary-button compact" disabled={!(selected ? canEdit : canCreate) || saving || !title.trim() || !dirty} onClick={() => void save()}>{saving ? 'Saving...' : dirty ? 'Save note' : 'Saved'}</button></div></div><input className="note-title-input" disabled={selected ? !canEdit : !canCreate} value={title} onChange={event => setTitle(event.target.value)} placeholder="Untitled note"/><textarea className="note-body-input" disabled={selected ? !canEdit : !canCreate} value={(selected ? canEdit : canCreate) ? body : filterContent(body, preferences.contentFilter)} onChange={event => setBody(event.target.value)} placeholder="Start writing..."/><UnsavedChangesBar dirty={dirty} busy={saving} onReset={resetNoteChanges} onSave={save}/></section>
    {commentsOpen && <aside className="comments-panel comments-panel-v70"><header><div><span className="eyebrow">DISCUSSION</span><h3>Comments</h3></div><span className="section-count">{comments.length}</span><button className="icon-button" onClick={() => setCommentsOpen(false)} aria-label="Close comments"><Icon name="x" size={14}/></button></header>{selected ? <><div className="comment-list comment-list-v70">{topComments.map(item => renderComment(item))}{!comments.length && <div className="mini-empty tall"><Icon name="chat"/><strong>No comments yet</strong><span>Start the discussion.</span></div>}</div><div className="comment-composer-wrap-v70">{replyToCommentId && <div className="comment-replying-v70"><span>Replying to {comments.find(item => item.id === replyToCommentId)?.authorName ?? 'comment'}</span><button onClick={() => setReplyToCommentId(null)}><Icon name="x" size={12}/></button></div>}<form className="comment-composer" onSubmit={event => { event.preventDefault(); void submitComment() }}><input value={comment} onChange={event => setComment(event.target.value)} placeholder={replyToCommentId ? 'Write a reply...' : 'Add a comment...'}/><button disabled={!comment.trim()}><Icon name="send" size={15}/></button></form></div></> : <div className="mini-empty tall"><Icon name="reply"/><span>Select a note to open its discussion.</span></div>}</aside>}
    <ContextMenu menu={contextMenu.menu} onClose={contextMenu.close}/><ContextMenu menu={commentMenu.menu} onClose={commentMenu.close}/>
  </div>
}
