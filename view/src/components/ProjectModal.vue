<script setup>
import { ref, onMounted, watch } from 'vue';
import { X, Plus, FolderOpen, Trash2, Save, FileText, Edit2, Check, AlertCircle } from 'lucide-vue-next';
import { projectService } from '@/services/project.service';

const props = defineProps({
  isOpen: Boolean,
  currentProjectId: String,
});

const emit = defineEmits(['close', 'load', 'create', 'delete', 'rename']);

const projects = ref([]);
const newProjectName = ref('');
const newProjectDescription = ref('');
const newProjectAspect = ref('portrait');
const editingId = ref(null);
const editingName = ref('');
const error = ref('');

const loadProjects = async () => {
  const response = await projectService.list();
  projects.value = response?.data || [];
};

onMounted(loadProjects);
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) loadProjects();
});

const handleCreate = async () => {
  if (!newProjectName.value.trim()) return;
  const response = await projectService.create({
    name: newProjectName.value.trim(),
    description: newProjectDescription.value.trim(),
    aspectPreset: newProjectAspect.value,
  });
  if (!response?.success) return;

  projects.value = [response.data, ...projects.value];
  newProjectName.value = '';
  newProjectDescription.value = '';
  newProjectAspect.value = 'portrait';
  error.value = '';
  emit('create', response.data.id);
};

const startEditing = (project) => {
  editingId.value = project.id;
  editingName.value = project.name;
};

const cancelEditing = () => {
  editingId.value = null;
  editingName.value = '';
};

const saveRename = async (id) => {
  if (!editingName.value.trim()) return;

  const response = await projectService.update(id, { name: editingName.value.trim() });
  if (response?.success) {
    projects.value = projects.value.map((p) => (p.id === id ? response.data : p));
  }

  emit('rename', { id, name: editingName.value.trim() });
  cancelEditing();
};

const handleDelete = async (id) => {
  await projectService.delete(id);
  projects.value = projects.value.filter(p => p.id !== id);
  emit('delete', id);
};

const handleLoad = (id) => {
  if (editingId.value) return; // Don't load while editing
  emit('load', id);
};

const vFocus = {
  mounted: (el) => el.focus()
};
</script>

<template>
  <Transition name="modal">
    <div v-if="isOpen" class="modal-overlay" @click="$emit('close')">
      <div class="modal-container" @click.stop>
        <div class="modal-header">
          <div class="header-title">
            <div class="icon-bg">
              <FolderOpen :size="18" class="icon" />
            </div>
            <div class="title-text">
              <h2>Scenarios</h2>
              <p>Manage your visual workflows</p>
            </div>
          </div>
          <button @click="$emit('close')" class="close-btn">
            <X :size="20" />
          </button>
        </div>

        <div class="modal-body custom-scrollbar">
          <div class="create-section">
            <div class="section-label">Create New</div>
            <div class="create-fields">
              <input
                v-model="newProjectName"
                type="text"
                placeholder="Scenario name..."
                class="main-input"
                @keyup.enter="handleCreate"
              />
              <textarea
                v-model="newProjectDescription"
                rows="2"
                placeholder="Description (optional)..."
                class="main-input desc-input"
              />
              <select v-model="newProjectAspect" class="main-input ratio-select">
                <option value="portrait">9:16 portrait</option>
                <option value="landscape">16:9 landscape</option>
              </select>
              <button type="button" @click="handleCreate" class="create-btn" :disabled="!newProjectName.trim()">
                <Plus :size="18" />
              </button>
            </div>
          </div>

          <div class="list-section">
            <div class="section-label">Saved Scenarios</div>
            <div v-if="projects.length === 0" class="empty-state">
              <AlertCircle :size="32" class="empty-icon" />
              <p>No scenarios found</p>
            </div>
            
            <TransitionGroup name="list" tag="div" class="projects-grid">
              <div 
                v-for="project in projects" 
                :key="project.id" 
                class="project-card" 
                :class="{ active: currentProjectId === project.id, editing: editingId === project.id }"
              >
                <div class="project-main" @click="handleLoad(project.id)">
                  <div class="project-icon-wrapper">
                    <FileText :size="16" />
                  </div>
                  
                  <div v-if="editingId === project.id" class="edit-input-wrapper" @click.stop>
                    <input 
                      v-model="editingName" 
                      type="text" 
                      class="edit-input"
                      @keyup.enter="saveRename(project.id)"
                      @keyup.esc="cancelEditing"
                      v-focus
                    />
                    <div class="edit-actions">
                      <button @click="saveRename(project.id)" class="action-btn success">
                        <Check :size="14" />
                      </button>
                      <button @click="cancelEditing" class="action-btn cancel">
                        <X :size="14" />
                      </button>
                    </div>
                  </div>
                  
                  <div v-else class="project-details">
                    <span class="project-name">{{ project.name }}</span>
                    <span v-if="currentProjectId === project.id" class="status-badge">Active</span>
                  </div>
                </div>

                <div v-if="editingId !== project.id" class="project-actions">
                  <button @click.stop="startEditing(project)" class="action-btn" title="Rename">
                    <Edit2 :size="14" />
                  </button>
                  <button
                    @click.stop="handleDelete(project.id)"
                    class="action-btn delete"
                    title="Delete"
                  >
                    <Trash2 :size="14" />
                  </button>
                </div>
              </div>
            </TransitionGroup>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1.5rem;
}

.modal-container {
  background-color: #09090b;
  border: 1px solid #1f1f23;
  width: 100%;
  max-width: 28rem;
  border-radius: 1.25rem;
  box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.9);
  display: flex;
  flex-direction: column;
  max-height: 80vh;
  overflow: hidden;
  animation: modalEnter 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modalEnter {
  from { opacity: 0; transform: scale(0.95) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #18181b;
  background-color: #0c0c0e;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.icon-bg {
  width: 2.25rem;
  height: 2.25rem;
  background-color: rgba(14, 165, 233, 0.1);
  border: 1px solid rgba(255, 202, 42, 0.2);
  border-radius: 0.625rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon {
  color: var(--color-accent-strong);
}

.title-text h2 {
  font-size: 1.125rem;
  font-weight: 700;
  color: #f4f4f5;
  letter-spacing: -0.02em;
  margin-bottom: 0.125rem;
}

.title-text p {
  font-size: 0.75rem;
  color: #71717a;
  font-weight: 500;
}

.close-btn {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.75rem;
  color: #71717a;
  background: transparent;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #f4f4f5;
  background-color: #18181b;
  border-color: #27272a;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section-label {
  font-size: 0.65rem;
  font-weight: 800;
  color: #52525b;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 0.75rem;
}

.input-wrapper {
  position: relative;
  display: flex;
  gap: 0.5rem;
}

.create-fields {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.create-fields .create-btn {
  align-self: flex-end;
}

.desc-input {
  resize: vertical;
  min-height: 3rem;
  font-family: inherit;
}

.ratio-select {
  flex: none;
}

.main-input {
  flex: 1;
  background-color: #0c0c0e;
  border: 1px solid #27272a;
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  color: #f4f4f5;
  outline: none;
  transition: all 0.2s;
  font-weight: 500;
}

.main-input:focus {
  border-color: var(--color-accent-strong);
  background-color: #111113;
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1);
}

.create-btn {
  width: 2.75rem;
  height: 2.75rem;
  background-color: var(--color-accent-strong);
  color: white;
  border: none;
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(255, 202, 42, 0.2);
}

.create-btn:hover:not(:disabled) {
  background-color: #0284c7;
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(14, 165, 233, 0.4);
}

.create-btn:disabled {
  background-color: #18181b;
  color: #3f3f46;
  cursor: not-allowed;
  box-shadow: none;
}

.projects-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}

.project-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  background-color: #0c0c0e;
  border: 1px solid #18181b;
  border-radius: 0.875rem;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.project-card:hover {
  border-color: #27272a;
  background-color: #111113;
  transform: translateY(-1px);
}

.project-card.active {
  border-color: rgba(14, 165, 233, 0.5);
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(14, 165, 233, 0.02) 100%);
  box-shadow: 0 8px 20px -8px rgba(0, 0, 0, 0.4);
}

.project-main {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  flex: 1;
  cursor: pointer;
}

.project-icon-wrapper {
  width: 2rem;
  height: 2rem;
  background-color: #18181b;
  border: 1px solid #27272a;
  border-radius: 0.625rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #71717a;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.active .project-icon-wrapper {
  background: linear-gradient(135deg, var(--color-accent-strong) 0%, #0284c7 100%);
  border-color: #38bdf8;
  color: white;
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.4);
}

.project-details {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.project-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: #f4f4f5;
}

.status-badge {
  font-size: 0.625rem;
  font-weight: 800;
  color: var(--color-accent-strong);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.edit-input-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
}

.edit-input {
  flex: 1;
  background-color: #18181b;
  border: 1px solid var(--color-accent-strong);
  border-radius: 0.625rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  color: #f4f4f5;
  outline: none;
}

.edit-actions {
  display: flex;
  gap: 0.25rem;
}

.project-actions {
  display: flex;
  gap: 0.5rem;
  opacity: 0;
  transition: opacity 0.2s;
}

.project-card:hover .project-actions {
  opacity: 1;
}

.action-btn {
  width: 2rem;
  height: 2rem;
  border-radius: 0.625rem;
  color: #71717a;
  background-color: #18181b;
  border: 1px solid #27272a;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn:hover {
  color: #f4f4f5;
  background-color: #27272a;
  border-color: #3f3f46;
}

.action-btn.delete:hover {
  color: #ef4444;
  background-color: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.2);
}

.action-btn.success {
  background-color: rgba(16, 185, 129, 0.1);
  color: #ffbb10;
  border-color: rgba(16, 185, 129, 0.2);
}

.action-btn.success:hover {
  background-color: #ffbb10;
  color: white;
}

.action-btn.cancel:hover {
  color: #ef4444;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  gap: 1rem;
  background-color: #0c0c0e;
  border: 1px dashed #27272a;
  border-radius: 1.5rem;
  color: #52525b;
}

.empty-icon {
  opacity: 0.2;
}

.empty-state p {
  font-size: 0.875rem;
  font-weight: 600;
}

/* Transitions */
.modal-enter-active, .modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from, .modal-leave-to {
  opacity: 0;
}

/* List Transitions */
.list-enter-active, .list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}

.list-leave-to {
  opacity: 0;
  transform: translateX(10px);
}

.list-move {
  transition: transform 0.3s ease;
}
</style>
