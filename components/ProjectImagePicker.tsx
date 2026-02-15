'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'

interface ImageInfo {
  filename: string
  relativePath: string
  size: number
}

interface ProjectImagePickerProps {
  projectId: string
  onSelect: (files: File[]) => void
  onClose: () => void
}

export default function ProjectImagePicker({ projectId, onSelect, onClose }: ProjectImagePickerProps) {
  const [images, setImages] = useState<ImageInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [draggingFolder, setDraggingFolder] = useState<string | null>(null)
  const dragCounters = useRef<Map<string, number>>(new Map())

  const fetchImages = useCallback(() => {
    fetch(`/api/claude-chat/project-images?projectId=${encodeURIComponent(projectId)}`)
      .then(r => r.json())
      .then(data => setImages(data.images || []))
      .catch(() => setImages([]))
      .finally(() => setLoading(false))
  }, [projectId])

  useEffect(() => { fetchImages() }, [fetchImages])

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const toggleSelect = useCallback((path: string) => {
    setSelectedPaths(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const handleConfirm = useCallback(async () => {
    if (selectedPaths.size === 0) return
    setSubmitting(true)
    try {
      const files: File[] = []
      for (const relPath of selectedPaths) {
        const img = images.find(i => i.relativePath === relPath)
        if (!img) continue
        const url = `/api/claude-chat/project-images/serve?projectId=${encodeURIComponent(projectId)}&path=${encodeURIComponent(relPath)}`
        const res = await fetch(url)
        if (!res.ok) continue
        const blob = await res.blob()
        files.push(new File([blob], img.filename, { type: blob.type }))
      }
      if (files.length > 0) onSelect(files)
      onClose()
    } catch {
      onClose()
    } finally {
      setSubmitting(false)
    }
  }, [selectedPaths, images, projectId, onSelect, onClose])

  // Upload files to a folder
  const uploadToFolder = useCallback(async (folder: string, files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (imageFiles.length === 0) return

    const formData = new FormData()
    formData.append('projectId', projectId)
    formData.append('folder', folder)
    for (const f of imageFiles) {
      formData.append('images', f)
    }

    try {
      const res = await fetch('/api/claude-chat/project-images', {
        method: 'POST',
        body: formData,
      })
      if (res.ok) {
        fetchImages()
      }
    } catch {
      // silently fail
    }
  }, [projectId, fetchImages])

  // Delete an image
  const deleteImage = useCallback(async (relativePath: string) => {
    try {
      const res = await fetch('/api/claude-chat/project-images', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, path: relativePath }),
      })
      if (res.ok) {
        setImages(prev => prev.filter(i => i.relativePath !== relativePath))
        setSelectedPaths(prev => {
          const next = new Set(prev)
          next.delete(relativePath)
          return next
        })
      }
    } catch {
      // silently fail
    }
  }, [projectId])

  // Drag handlers for folder sections
  const handleFolderDragEnter = useCallback((folder: string, e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const count = (dragCounters.current.get(folder) || 0) + 1
    dragCounters.current.set(folder, count)
    if (e.dataTransfer.types.includes('Files')) {
      setDraggingFolder(folder)
    }
  }, [])

  const handleFolderDragLeave = useCallback((folder: string, e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const count = (dragCounters.current.get(folder) || 0) - 1
    dragCounters.current.set(folder, count)
    if (count <= 0) {
      dragCounters.current.set(folder, 0)
      if (draggingFolder === folder) setDraggingFolder(null)
    }
  }, [draggingFolder])

  const handleFolderDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleFolderDrop = useCallback((folder: string, e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounters.current.set(folder, 0)
    setDraggingFolder(null)
    if (e.dataTransfer.files?.length > 0) {
      uploadToFolder(folder, e.dataTransfer.files)
    }
  }, [uploadToFolder])

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  // Group images by their parent directory
  const groupedImages = useMemo(() => {
    const groups: { folder: string; images: ImageInfo[] }[] = []
    const folderMap = new Map<string, ImageInfo[]>()

    for (const img of images) {
      const slashIndex = img.relativePath.lastIndexOf('/')
      const folder = slashIndex === -1 ? '' : img.relativePath.substring(0, slashIndex)
      if (!folderMap.has(folder)) folderMap.set(folder, [])
      folderMap.get(folder)!.push(img)
    }

    const folders = Array.from(folderMap.keys()).sort((a, b) => {
      if (a === '') return -1
      if (b === '') return 1
      return a.localeCompare(b)
    })

    for (const folder of folders) {
      groups.push({ folder, images: folderMap.get(folder)! })
    }

    return groups
  }, [images])

  const renderImageCard = (img: ImageInfo) => {
    const isSelected = selectedPaths.has(img.relativePath)
    const thumbUrl = `/api/claude-chat/project-images/serve?projectId=${encodeURIComponent(projectId)}&path=${encodeURIComponent(img.relativePath)}`
    return (
      <div
        key={img.relativePath}
        className="relative rounded-lg overflow-hidden transition-all duration-150 text-left group"
        style={{
          border: isSelected ? '2px solid #ffffff' : '2px solid transparent',
          backgroundColor: '#111111',
        }}
      >
        <button
          onClick={() => toggleSelect(img.relativePath)}
          className="w-full text-left"
        >
          <div className="aspect-square">
            <img
              suppressHydrationWarning
              src={thumbUrl}
              alt={img.filename}
              loading="lazy"
              className="w-full h-full object-cover"
            />
          </div>
          {isSelected && (
            <div
              className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
              style={{ backgroundColor: '#ffffff', color: '#000000' }}
            >
              &#10003;
            </div>
          )}
          <div className="px-1.5 py-1">
            <div
              className="text-[10px] truncate"
              style={{ color: '#999999' }}
              title={img.relativePath}
            >
              {img.filename}
            </div>
            <div className="text-[9px]" style={{ color: '#555555' }}>
              {formatSize(img.size)}
            </div>
          </div>
        </button>
        {/* Delete button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            deleteImage(img.relativePath)
          }}
          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ backgroundColor: '#ef4444', color: 'white' }}
          title="刪除圖片"
        >
          &#10005;
        </button>
      </div>
    )
  }

  const renderFolderSection = (folder: string, folderImages: ImageInfo[]) => {
    const isDragTarget = draggingFolder === folder
    const folderKey = folder || '__root__'

    return (
      <div
        key={folderKey}
        className="rounded-lg transition-all duration-150"
        style={{
          border: isDragTarget ? '1px dashed #ffffff' : '1px dashed transparent',
          padding: isDragTarget ? '8px' : '8px',
          backgroundColor: isDragTarget ? 'rgba(255,255,255,0.03)' : 'transparent',
        }}
        onDragEnter={(e) => handleFolderDragEnter(folder, e)}
        onDragLeave={(e) => handleFolderDragLeave(folder, e)}
        onDragOver={handleFolderDragOver}
        onDrop={(e) => handleFolderDrop(folder, e)}
      >
        <div
          className="text-[11px] font-medium mb-2 px-0.5 transition-colors duration-150"
          style={{ color: isDragTarget ? '#ffffff' : '#666666' }}
        >
          {folder || '/'}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {folderImages.map(renderImageCard)}
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="rounded-lg flex flex-col"
        style={{
          backgroundColor: '#000000',
          border: '1px solid #222222',
          width: '560px',
          maxWidth: '90vw',
          maxHeight: '70vh',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid #222222' }}
        >
          <span className="text-sm font-medium" style={{ color: '#ffffff' }}>
            專案圖片
          </span>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded flex items-center justify-center text-xs transition-colors hover:bg-white/10"
            style={{ color: '#666666' }}
          >
            &#10005;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <span className="text-xs animate-pulse" style={{ color: '#666666' }}>載入中...</span>
            </div>
          )}

          {/* Empty state — global drop zone */}
          {!loading && images.length === 0 && (
            <div
              className="flex items-center justify-center py-12 rounded-lg transition-all duration-150"
              style={{
                border: draggingFolder === 'images' ? '1px dashed #ffffff' : '1px dashed #333333',
                backgroundColor: draggingFolder === 'images' ? 'rgba(255,255,255,0.03)' : 'transparent',
              }}
              onDragEnter={(e) => handleFolderDragEnter('images', e)}
              onDragLeave={(e) => handleFolderDragLeave('images', e)}
              onDragOver={handleFolderDragOver}
              onDrop={(e) => handleFolderDrop('images', e)}
            >
              <span className="text-xs" style={{ color: draggingFolder === 'images' ? '#ffffff' : '#666666' }}>
                拖曳圖片到此處新增
              </span>
            </div>
          )}

          {!loading && images.length > 0 && (
            <div className="space-y-2">
              {groupedImages.map(group => renderFolderSection(group.folder, group.images))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderTop: '1px solid #222222' }}
        >
          <span className="text-xs" style={{ color: '#666666' }}>
            {selectedPaths.size > 0 ? `已選擇 ${selectedPaths.size} 張圖片` : '點擊選擇 · 拖曳新增'}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded text-xs transition-colors hover:bg-white/10"
              style={{ color: '#999999' }}
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedPaths.size === 0 || submitting}
              className="px-3 py-1.5 rounded text-xs font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                backgroundColor: selectedPaths.size > 0 ? '#333333' : '#111111',
                color: selectedPaths.size > 0 ? '#ffffff' : '#666666',
              }}
            >
              {submitting ? '載入中...' : '確認加入'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
