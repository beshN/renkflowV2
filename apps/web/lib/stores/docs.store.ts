/**
 * Documents & Whiteboard Store - Zustand
 * Rich text documents and collaborative whiteboard state
 */

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  Doc,
  DocBlock,
  DocComment,
  DocBlockType,
} from '@/lib/types/enterprise';

// ============================================
// Types
// ============================================

interface DocsState {
  // Documents
  documents: Doc[];
  activeDocId: string | null;
  
  // Editor state
  editorState: {
    isSaving: boolean;
    lastSaved: string | null;
    hasUnsavedChanges: boolean;
    collaborators: Collaborator[];
  };
  
  // Comments
  comments: DocComment[];
  activeCommentId: string | null;
  
  // Whiteboard
  whiteboards: WhiteboardDoc[];
  activeWhiteboardId: string | null;
  
  // View state
  sidebarOpen: boolean;
  viewMode: 'edit' | 'preview' | 'split';
  
  // Search
  searchQuery: string;
  searchResults: SearchResult[];
}

interface Collaborator {
  userId: string;
  userName: string;
  userAvatar?: string;
  cursorPosition?: { blockId: string; offset: number };
  color: string;
  lastActive: string;
}

interface WhiteboardDoc {
  id: string;
  tenantId: string;
  title: string;
  elements: WhiteboardElement[];
  viewport: { x: number; y: number; zoom: number };
  backgroundColor: string;
  gridEnabled: boolean;
  projectId?: string;
  taskId?: string;
  createdAt: string;
  updatedAt: string;
}

interface WhiteboardElement {
  id: string;
  type: 'sticky' | 'shape' | 'text' | 'image' | 'drawing' | 'connector' | 'frame';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  locked: boolean;
  props: Record<string, unknown>;
}

interface SearchResult {
  docId: string;
  docTitle: string;
  blockId?: string;
  snippet: string;
  score: number;
}

interface DocsActions {
  // Document CRUD
  createDocument: (doc: Partial<Doc>) => string;
  updateDocument: (docId: string, updates: Partial<Doc>) => void;
  deleteDocument: (docId: string) => void;
  duplicateDocument: (docId: string) => string;
  
  // Document navigation
  openDocument: (docId: string) => void;
  closeDocument: () => void;
  
  // Block operations
  addBlock: (docId: string, block: DocBlock, afterBlockId?: string) => void;
  updateBlock: (docId: string, blockId: string, updates: Partial<DocBlock>) => void;
  deleteBlock: (docId: string, blockId: string) => void;
  moveBlock: (docId: string, blockId: string, newIndex: number) => void;
  
  // Comments
  addComment: (docId: string, blockId: string | null, content: string) => void;
  resolveComment: (commentId: string) => void;
  deleteComment: (commentId: string) => void;
  replyToComment: (commentId: string, content: string) => void;
  
  // Whiteboard
  createWhiteboard: (title: string, projectId?: string) => string;
  updateWhiteboard: (whiteboardId: string, updates: Partial<WhiteboardDoc>) => void;
  deleteWhiteboard: (whiteboardId: string) => void;
  openWhiteboard: (whiteboardId: string) => void;
  
  // Whiteboard elements
  addElement: (whiteboardId: string, element: WhiteboardElement) => void;
  updateElement: (whiteboardId: string, elementId: string, updates: Partial<WhiteboardElement>) => void;
  deleteElement: (whiteboardId: string, elementId: string) => void;
  moveElement: (whiteboardId: string, elementId: string, x: number, y: number) => void;
  resizeElement: (whiteboardId: string, elementId: string, width: number, height: number) => void;
  
  // Collaboration
  updateCollaborator: (collaborator: Collaborator) => void;
  removeCollaborator: (userId: string) => void;
  
  // Editor state
  setSaving: (isSaving: boolean) => void;
  markSaved: () => void;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  
  // View
  toggleSidebar: () => void;
  setViewMode: (mode: 'edit' | 'preview' | 'split') => void;
  
  // Search
  search: (query: string) => void;
  clearSearch: () => void;
}

type DocsStore = DocsState & DocsActions;

// ============================================
// Helper Functions
// ============================================

function generateId(prefix = 'doc'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getRandomColor(): string {
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// ============================================
// Initial State
// ============================================

const initialState: DocsState = {
  documents: [],
  activeDocId: null,
  editorState: {
    isSaving: false,
    lastSaved: null,
    hasUnsavedChanges: false,
    collaborators: [],
  },
  comments: [],
  activeCommentId: null,
  whiteboards: [],
  activeWhiteboardId: null,
  sidebarOpen: true,
  viewMode: 'edit',
  searchQuery: '',
  searchResults: [],
};

// ============================================
// Store Implementation
// ============================================

export const useDocsStore = create<DocsStore>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set, get) => ({
          ...initialState,

          // Document CRUD
          createDocument: (doc) => {
            const id = generateId('doc');
            const newDoc: Doc = {
              id,
              tenantId: doc.tenantId || '',
              title: doc.title || 'Untitled',
              content: doc.content || '[]',
              parentId: doc.parentId,
              projectId: doc.projectId,
              taskId: doc.taskId,
              icon: doc.icon,
              coverImage: doc.coverImage,
              isTemplate: doc.isTemplate || false,
              isArchived: false,
              version: 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            } as Doc;

            set((state) => {
              state.documents.push(newDoc);
              state.activeDocId = id;
            });

            return id;
          },

          updateDocument: (docId, updates) => {
            set((state) => {
              const index = state.documents.findIndex((d) => d.id === docId);
              if (index !== -1) {
                state.documents[index] = {
                  ...state.documents[index],
                  ...updates,
                  updatedAt: new Date().toISOString(),
                  version: (state.documents[index].version || 1) + 1,
                };
                state.editorState.hasUnsavedChanges = true;
              }
            });
          },

          deleteDocument: (docId) => {
            set((state) => {
              state.documents = state.documents.filter((d) => d.id !== docId);
              if (state.activeDocId === docId) {
                state.activeDocId = null;
              }
            });
          },

          duplicateDocument: (docId) => {
            const doc = get().documents.find((d) => d.id === docId);
            if (!doc) return '';

            const newId = generateId('doc');
            const duplicated: Doc = {
              ...doc,
              id: newId,
              title: `${doc.title} (Copy)`,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              version: 1,
            } as Doc;

            set((state) => {
              state.documents.push(duplicated);
            });

            return newId;
          },

          // Document navigation
          openDocument: (docId) => {
            set((state) => {
              state.activeDocId = docId;
              state.activeWhiteboardId = null;
            });
          },

          closeDocument: () => {
            set((state) => {
              state.activeDocId = null;
            });
          },

          // Block operations
          addBlock: (docId, block, afterBlockId) => {
            set((state) => {
              const doc = state.documents.find((d) => d.id === docId);
              if (!doc) return;

              const blocks: DocBlock[] = JSON.parse(doc.content || '[]');
              const insertIndex = afterBlockId
                ? blocks.findIndex((b) => b.id === afterBlockId) + 1
                : blocks.length;

              blocks.splice(insertIndex, 0, block);
              doc.content = JSON.stringify(blocks);
              doc.updatedAt = new Date().toISOString();
              state.editorState.hasUnsavedChanges = true;
            });
          },

          updateBlock: (docId, blockId, updates) => {
            set((state) => {
              const doc = state.documents.find((d) => d.id === docId);
              if (!doc) return;

              const blocks: DocBlock[] = JSON.parse(doc.content || '[]');
              const blockIndex = blocks.findIndex((b) => b.id === blockId);
              if (blockIndex !== -1) {
                blocks[blockIndex] = { ...blocks[blockIndex], ...updates };
                doc.content = JSON.stringify(blocks);
                doc.updatedAt = new Date().toISOString();
                state.editorState.hasUnsavedChanges = true;
              }
            });
          },

          deleteBlock: (docId, blockId) => {
            set((state) => {
              const doc = state.documents.find((d) => d.id === docId);
              if (!doc) return;

              const blocks: DocBlock[] = JSON.parse(doc.content || '[]');
              doc.content = JSON.stringify(blocks.filter((b) => b.id !== blockId));
              doc.updatedAt = new Date().toISOString();
              state.editorState.hasUnsavedChanges = true;
            });
          },

          moveBlock: (docId, blockId, newIndex) => {
            set((state) => {
              const doc = state.documents.find((d) => d.id === docId);
              if (!doc) return;

              const blocks: DocBlock[] = JSON.parse(doc.content || '[]');
              const currentIndex = blocks.findIndex((b) => b.id === blockId);
              if (currentIndex === -1) return;

              const [removed] = blocks.splice(currentIndex, 1);
              blocks.splice(newIndex, 0, removed);
              doc.content = JSON.stringify(blocks);
              doc.updatedAt = new Date().toISOString();
              state.editorState.hasUnsavedChanges = true;
            });
          },

          // Comments
          addComment: (docId, blockId, content) => {
            const comment: DocComment = {
              id: generateId('comment'),
              docId,
              blockId: blockId || undefined,
              content,
              authorId: '', // Would be set from auth context
              authorName: 'Current User',
              isResolved: false,
              replies: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            set((state) => {
              state.comments.push(comment);
            });
          },

          resolveComment: (commentId) => {
            set((state) => {
              const comment = state.comments.find((c) => c.id === commentId);
              if (comment) {
                comment.isResolved = true;
                comment.updatedAt = new Date().toISOString();
              }
            });
          },

          deleteComment: (commentId) => {
            set((state) => {
              state.comments = state.comments.filter((c) => c.id !== commentId);
            });
          },

          replyToComment: (commentId, content) => {
            set((state) => {
              const comment = state.comments.find((c) => c.id === commentId);
              if (comment) {
                comment.replies.push({
                  id: generateId('reply'),
                  docId: comment.docId,
                  content,
                  authorId: '',
                  authorName: 'Current User',
                  isResolved: false,
                  replies: [],
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                });
                comment.updatedAt = new Date().toISOString();
              }
            });
          },

          // Whiteboard
          createWhiteboard: (title, projectId) => {
            const id = generateId('wb');
            const whiteboard: WhiteboardDoc = {
              id,
              tenantId: '',
              title,
              elements: [],
              viewport: { x: 0, y: 0, zoom: 1 },
              backgroundColor: '#ffffff',
              gridEnabled: true,
              projectId,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            set((state) => {
              state.whiteboards.push(whiteboard);
              state.activeWhiteboardId = id;
            });

            return id;
          },

          updateWhiteboard: (whiteboardId, updates) => {
            set((state) => {
              const index = state.whiteboards.findIndex((w) => w.id === whiteboardId);
              if (index !== -1) {
                state.whiteboards[index] = {
                  ...state.whiteboards[index],
                  ...updates,
                  updatedAt: new Date().toISOString(),
                };
              }
            });
          },

          deleteWhiteboard: (whiteboardId) => {
            set((state) => {
              state.whiteboards = state.whiteboards.filter((w) => w.id !== whiteboardId);
              if (state.activeWhiteboardId === whiteboardId) {
                state.activeWhiteboardId = null;
              }
            });
          },

          openWhiteboard: (whiteboardId) => {
            set((state) => {
              state.activeWhiteboardId = whiteboardId;
              state.activeDocId = null;
            });
          },

          // Whiteboard elements
          addElement: (whiteboardId, element) => {
            set((state) => {
              const wb = state.whiteboards.find((w) => w.id === whiteboardId);
              if (wb) {
                wb.elements.push(element);
                wb.updatedAt = new Date().toISOString();
              }
            });
          },

          updateElement: (whiteboardId, elementId, updates) => {
            set((state) => {
              const wb = state.whiteboards.find((w) => w.id === whiteboardId);
              if (wb) {
                const element = wb.elements.find((e) => e.id === elementId);
                if (element) {
                  Object.assign(element, updates);
                  wb.updatedAt = new Date().toISOString();
                }
              }
            });
          },

          deleteElement: (whiteboardId, elementId) => {
            set((state) => {
              const wb = state.whiteboards.find((w) => w.id === whiteboardId);
              if (wb) {
                wb.elements = wb.elements.filter((e) => e.id !== elementId);
                wb.updatedAt = new Date().toISOString();
              }
            });
          },

          moveElement: (whiteboardId, elementId, x, y) => {
            get().updateElement(whiteboardId, elementId, { x, y });
          },

          resizeElement: (whiteboardId, elementId, width, height) => {
            get().updateElement(whiteboardId, elementId, { width, height });
          },

          // Collaboration
          updateCollaborator: (collaborator) => {
            set((state) => {
              const index = state.editorState.collaborators.findIndex(
                (c) => c.userId === collaborator.userId
              );
              if (index !== -1) {
                state.editorState.collaborators[index] = collaborator;
              } else {
                state.editorState.collaborators.push({
                  ...collaborator,
                  color: collaborator.color || getRandomColor(),
                });
              }
            });
          },

          removeCollaborator: (userId) => {
            set((state) => {
              state.editorState.collaborators = state.editorState.collaborators.filter(
                (c) => c.userId !== userId
              );
            });
          },

          // Editor state
          setSaving: (isSaving) => {
            set((state) => {
              state.editorState.isSaving = isSaving;
            });
          },

          markSaved: () => {
            set((state) => {
              state.editorState.isSaving = false;
              state.editorState.lastSaved = new Date().toISOString();
              state.editorState.hasUnsavedChanges = false;
            });
          },

          setHasUnsavedChanges: (hasChanges) => {
            set((state) => {
              state.editorState.hasUnsavedChanges = hasChanges;
            });
          },

          // View
          toggleSidebar: () => {
            set((state) => {
              state.sidebarOpen = !state.sidebarOpen;
            });
          },

          setViewMode: (mode) => {
            set((state) => {
              state.viewMode = mode;
            });
          },

          // Search
          search: (query) => {
            set((state) => {
              state.searchQuery = query;
              
              if (!query.trim()) {
                state.searchResults = [];
                return;
              }

              const lowerQuery = query.toLowerCase();
              const results: SearchResult[] = [];

              state.documents.forEach((doc) => {
                // Search in title
                if (doc.title.toLowerCase().includes(lowerQuery)) {
                  results.push({
                    docId: doc.id,
                    docTitle: doc.title,
                    snippet: doc.title,
                    score: 1,
                  });
                }

                // Search in content
                try {
                  const blocks: DocBlock[] = JSON.parse(doc.content || '[]');
                  blocks.forEach((block) => {
                    const content = typeof block.content === 'string' 
                      ? block.content 
                      : JSON.stringify(block.content);
                    
                    if (content.toLowerCase().includes(lowerQuery)) {
                      results.push({
                        docId: doc.id,
                        docTitle: doc.title,
                        blockId: block.id,
                        snippet: content.slice(0, 100),
                        score: 0.5,
                      });
                    }
                  });
                } catch (e) {
                  // Ignore parse errors
                }
              });

              state.searchResults = results.sort((a, b) => b.score - a.score);
            });
          },

          clearSearch: () => {
            set((state) => {
              state.searchQuery = '';
              state.searchResults = [];
            });
          },
        }))
      ),
      {
        name: 'renkflow-docs-store',
        partialize: (state) => ({
          documents: state.documents.slice(-100), // Keep last 100 docs
          whiteboards: state.whiteboards.slice(-50), // Keep last 50 whiteboards
          sidebarOpen: state.sidebarOpen,
          viewMode: state.viewMode,
        }),
      }
    ),
    { name: 'DocsStore' }
  )
);

// ============================================
// Selectors
// ============================================

export const selectDocuments = (state: DocsStore) => state.documents;
export const selectActiveDocument = (state: DocsStore) =>
  state.documents.find((d) => d.id === state.activeDocId);
export const selectWhiteboards = (state: DocsStore) => state.whiteboards;
export const selectActiveWhiteboard = (state: DocsStore) =>
  state.whiteboards.find((w) => w.id === state.activeWhiteboardId);
export const selectComments = (docId: string) => (state: DocsStore) =>
  state.comments.filter((c) => c.docId === docId);

// ============================================
// Block Type Labels
// ============================================

export const BLOCK_TYPE_LABELS: Record<DocBlockType, string> = {
  paragraph: 'Paragraf',
  heading1: 'Başlık 1',
  heading2: 'Başlık 2',
  heading3: 'Başlık 3',
  bullet_list: 'Madde İşaretli Liste',
  numbered_list: 'Numaralı Liste',
  todo_list: 'Yapılacaklar',
  code: 'Kod Bloğu',
  quote: 'Alıntı',
  divider: 'Ayırıcı',
  table: 'Tablo',
  image: 'Görsel',
  video: 'Video',
  embed: 'Gömme',
  task_reference: 'Görev Referansı',
  mention: 'Bahsetme',
  callout: 'Uyarı',
  toggle: 'Açılır Liste',
};
