// SPACES_V92_1_FOLDER_ACTIONS — view, rename, and delete are server-authorized.
import type { DragEvent } from 'react'
import { Icon } from '../../components/Icon'
import { ContextMenu, useContextMenu, type ContextAction } from '../../components/ContextMenu'

export type NotesFolderV89 = { id: string; name: string; sortOrder: number; createdBy: string }
export function NotesFolderTabsV89({ folders, active, onChoose, canEdit, canCreate, onAdd, onMove,
  onRename, onDelete, selectedNoteId, assignedFolderId, folderLoading, folderUnavailable }: {
  folders: NotesFolderV89[]; active: string; onChoose: (id: string) => void
  canEdit: boolean; canCreate: boolean; onAdd: () => void
  onMove: (noteId: string, folderId: string | null) => void
  onRename: (folder: NotesFolderV89) => void; onDelete: (folder: NotesFolderV89) => void
  selectedNoteId: string; assignedFolderId: string | null
  folderLoading: boolean; folderUnavailable: boolean
}) {
  const menu = useContextMenu()
  const receive = (event: DragEvent, folderId: string | null) => {
    event.preventDefault()
    const noteId = event.dataTransfer.getData('application/x-spaces-note-v89')
    if (canEdit && noteId) onMove(noteId, folderId)
  }
  function actions(folder: NotesFolderV89): ContextAction[] {
    return [
      { id: 'folder-view', label: 'Open folder', icon: 'folder', onSelect: () => onChoose(folder.id) },
      ...(canEdit ? [
        { id: 'folder-rename', label: 'Rename folder', icon: 'edit' as const, onSelect: () => onRename(folder) },
        { id: 'folder-delete', label: 'Delete folder', icon: 'trash' as const, danger: true, onSelect: () => onDelete(folder) },
      ] : []),
    ]
  }
  return <div className="notes-folder-zone-v89 spaces-v921-notes-folders" aria-label="Notes folders">
    <div className="notes-folder-tabs-v89" role="tablist" aria-label="Folder tabs">
      <button type="button" role="tab" aria-selected={active === 'all'} className={active === 'all' ? 'active' : ''}
        onClick={() => onChoose('all')} onDragOver={event => { if (canEdit) event.preventDefault() }} onDrop={event => receive(event, null)}>
        <Icon name="notes" size={14} /> All notes
      </button>
      {folders.map(folder => <div className={`spaces-v921-folder-chip ${active === folder.id ? 'active' : ''}`} key={folder.id}
        onDragOver={event => { if (canEdit) event.preventDefault() }} onDrop={event => receive(event, folder.id)}>
        <button type="button" role="tab" aria-selected={active === folder.id} className="spaces-v921-folder-select"
          {...menu.bind(folder.name, actions(folder), 'Notes folder')} onClick={() => onChoose(folder.id)}>
          <Icon name="folder" size={14} /> <span>{folder.name}</span>
        </button>
        <button type="button" className="spaces-v921-folder-menu" aria-label={`Options for ${folder.name}`} title="Folder actions"
          onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); menu.open(folder.name, actions(folder), rect.right, rect.bottom, 'Notes folder') }}>
          <Icon name="more" size={14} />
        </button>
      </div>)}
      {canCreate && <button type="button" onClick={onAdd} aria-label="Create notes folder" title="Add folder"><Icon name="plus" size={14} /></button>}
    </div>
    <div className="notes-folder-tools-v89"><small>{folderLoading ? 'Updating folders…' : folderUnavailable ? 'Folder access unavailable — check the V89 Worker and migration' : 'Shared with members who can view this channel'}</small>
      {selectedNoteId && canEdit && <label>Save in <select value={assignedFolderId ?? ''} onChange={event => onMove(selectedNoteId, event.target.value || null)} aria-label="Move current note to folder">
        <option value="">No folder</option>{folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
      </select></label>}
    </div>
    <ContextMenu menu={menu.menu} onClose={menu.close} />
  </div>
}
