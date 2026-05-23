import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Image as ImageIcon,
  Type,
  MoreVertical,
  Trash2,
  Edit3,
  ExternalLink,
  X,
  Upload,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Heart,
  MessageCircle,
  Calendar,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { db, storage } from '../lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, Timestamp, deleteDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { uploadImageToImageKit } from '../services/imageUploadService';
import { useAuth } from '../context/AuthContext';
import { Resource } from '../types';

interface ResourceLike {
  id: string;
  userId: string;
  userName?: string;
  createdAt: string;
}

interface ResourceComment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}

const CATEGORIES = [
  'Wellness - Thriving',
  'Wellness - Stress Aware',
  'Wellness - Emotionally Aware',
  'Mild Support',
  'Recovery & Improvement',
  'Moderate Support'
];

export default function Resources() {
  const { advisorProfile, currentUser } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'text' | 'image'>('image');
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [authorImages, setAuthorImages] = useState<Record<string, string>>({});

  // View interactions modal state
  const [viewingResource, setViewingResource] = useState<Resource | null>(null);
  const [resourceLikes, setResourceLikes] = useState<ResourceLike[]>([]);
  const [resourceComments, setResourceComments] = useState<ResourceComment[]>([]);
  const [isLoadingInteractions, setIsLoadingInteractions] = useState(false);
  
  // New Resource Form State
  const [newResource, setNewResource] = useState({
    title: '',
    type: 'text' as 'text' | 'image',
    content: '',
    category: CATEGORIES[0],
    image: null as File | null,
    imagePreview: ''
  });

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    try {
      setIsLoading(true);
      const q = query(collection(db, 'resources'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetchedResources: Resource[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        fetchedResources.push({
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString().split('T')[0] : data.createdAt
        } as Resource);
      });
      setResources(fetchedResources);

      // Build image map from denormalized authorImageUrl on each resource first
      const imageMap: Record<string, string> = {};
      fetchedResources.forEach(r => {
        if (r.authorId && r.authorImageUrl) imageMap[r.authorId] = r.authorImageUrl;
      });
      // Inject the current user's own image without needing a Firestore read
      if (currentUser && advisorProfile?.profileImageUrl) {
        imageMap[currentUser.uid] = advisorProfile.profileImageUrl;
      }

      // For any author still missing an image, fall back to a Firestore lookup
      const missingIds = [...new Set(fetchedResources.map(r => r.authorId).filter(id => id && !imageMap[id]))];
      if (missingIds.length > 0) {
        const imageEntries = await Promise.all(
          missingIds.map(async (id) => {
            try {
              const snap = await getDoc(doc(db, 'advisors', id));
              const url = snap.exists() ? (snap.data().profileImageUrl || '') : '';
              return [id, url] as [string, string];
            } catch {
              return [id, ''] as [string, string];
            }
          })
        );
        imageEntries.forEach(([id, url]) => { if (url) imageMap[id] = url; });
      }
      setAuthorImages(imageMap);

      // Silently backfill authorImageUrl on the current user's old resources that are missing it
      if (currentUser && advisorProfile?.profileImageUrl) {
        const toBackfill = fetchedResources.filter(
          r => r.authorId === currentUser.uid && !r.authorImageUrl
        );
        toBackfill.forEach(r => {
          updateDoc(doc(db, 'resources', r.id), { authorImageUrl: advisorProfile.profileImageUrl }).catch(() => {});
        });
      }
    } catch (error) {
      console.error("Error fetching resources:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchResourceInteractions = async (resource: Resource) => {
    setViewingResource(resource);
    setIsLoadingInteractions(true);
    setResourceLikes([]);
    setResourceComments([]);
    try {
      const [likesSnap, commentsSnap] = await Promise.all([
        getDocs(query(collection(db, 'resources', resource.id, 'likes'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'resources', resource.id, 'comments'), orderBy('createdAt', 'desc')))
      ]);

      const likes: ResourceLike[] = likesSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          userId: data.userId || '',
          userName: data.userName,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString().split('T')[0] : (data.createdAt || '')
        };
      });

      const comments: ResourceComment[] = commentsSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          userId: data.userId || '',
          userName: data.userName || 'Anonymous',
          text: data.text || data.comment || '',
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString().split('T')[0] : (data.createdAt || '')
        };
      });

      setResourceLikes(likes);
      setResourceComments(comments);
    } catch (error) {
      console.error('Error fetching resource interactions:', error);
    } finally {
      setIsLoadingInteractions(false);
    }
  };

  const filteredResources = resources.filter(res => {
    const matchesSearch = res.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         res.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || res.resource_type === filterType;
    return matchesSearch && matchesType;
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewResource(prev => ({ 
        ...prev, 
        image: file, 
        imagePreview: URL.createObjectURL(file) 
      }));
    }
  };

  const handleDeleteResource = async (resource: Resource) => {
    if (!window.confirm('Are you sure you want to delete this resource?')) return;

    try {
      setIsDeleting(resource.id);
      
      // Delete from Firestore
      await deleteDoc(doc(db, 'resources', resource.id));

      // Delete from Storage if it's an image
      if (resource.resource_type === 'image' && resource.image_url) {
        try {
          const imageRef = ref(storage, resource.image_url);
          await deleteObject(imageRef);
        } catch (storageError) {
          console.error("Error deleting image from storage:", storageError);
          // Continue even if storage delete fails
        }
      }

      setResources(prev => prev.filter(r => r.id !== resource.id));
    } catch (error) {
      console.error("Error deleting resource:", error);
      alert("Failed to delete resource.");
    } finally {
      setIsDeleting(null);
      setActiveMenuId(null);
    }
  };

  const openEditModal = (resource: Resource) => {
    setEditingResource(resource);
    setNewResource({
      title: resource.title,
      type: resource.resource_type,
      content: resource.resource,
      category: resource.category,
      image: null,
      imagePreview: resource.image_url || ''
    });
    setIsModalOpen(true);
    setActiveMenuId(null);
  };

  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !advisorProfile) return;

    try {
      setIsPublishing(true);
      let imageUrl = editingResource?.image_url || '';

      // Upload new image to ImageKit if provided
      if (newResource.type === 'image' && newResource.image) {
        setIsUploading(true);
        imageUrl = await uploadImageToImageKit(newResource.image, 'resources');
        setIsUploading(false);
      }

      const resourceData = {
        title: newResource.title,
        category: newResource.category,
        resource_type: newResource.type,
        resource: newResource.content,
        author: advisorProfile.name,
        authorId: currentUser.uid,
        authorImageUrl: advisorProfile.profileImageUrl || '',
        ...(newResource.type === 'image' ? { image_url: imageUrl || "" } : {}),
        ...(!editingResource ? { likeCount: 0, viewCount: 0 } : {})
      };

      if (editingResource) {
        // Update existing
        await updateDoc(doc(db, 'resources', editingResource.id), {
          ...resourceData,
          updatedAt: serverTimestamp()
        });
        
        setResources(prev => prev.map(r => r.id === editingResource.id ? { 
          ...r, 
          ...resourceData,
          image_url: newResource.type === 'image' ? imageUrl : undefined
        } as Resource : r));
      } else {
        // Create new
        const resourceWithTimestamp = {
          ...resourceData,
          createdAt: serverTimestamp()
        };
        const docRef = await addDoc(collection(db, 'resources'), resourceWithTimestamp);
        
        const newResourceItem: Resource = {
          id: docRef.id,
          ...resourceData,
          createdAt: new Date().toISOString().split('T')[0],
          image_url: newResource.type === 'image' ? imageUrl : undefined
        } as Resource;

        setResources([newResourceItem, ...resources]);
      }

      setIsModalOpen(false);
      setEditingResource(null);
      setNewResource({ title: '', type: 'text', content: '', category: CATEGORIES[0], image: null, imagePreview: '' });
    } catch (error) {
      console.error("Error saving resource:", error);
      alert("Failed to save resource. Please try again.");
    } finally {
      setIsUploading(false);
      setIsPublishing(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Resource Library</h1>
          <p className="text-slate-500 mt-1">Manage and share educational content with your users.</p>
        </div>
        <button 
          onClick={() => {
            setEditingResource(null);
            setNewResource({ title: '', type: 'text', content: '', category: CATEGORIES[0], image: null, imagePreview: '' });
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-2xl font-semibold shadow-lg shadow-brand-200 transition-all active:scale-95"
        >
          <Plus size={20} />
          <span>Add Resource</span>
        </button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Search by title or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-brand-500 transition-all text-sm"
          />
        </div>
        <div className="flex gap-2 p-1 bg-slate-50 rounded-2xl border border-slate-100">
          {(['all', 'text', 'image'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-semibold capitalize transition-all",
                filterType === type 
                  ? "bg-white text-brand-600 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Resource Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-12 h-12 text-brand-600 animate-spin" />
          <p className="text-slate-500 font-medium">Loading resources...</p>
        </div>
      ) : filteredResources.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[3rem] border border-slate-100 shadow-sm">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
            <Search size={40} />
          </div>
          <h3 className="text-xl font-bold text-slate-800">No resources found</h3>
          <p className="text-slate-500">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredResources.map((resource) => (
              <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={resource.id}
                className="group bg-white rounded-[2rem] border border-slate-100 overflow-hidden hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 flex flex-col"
              >
                {resource.resource_type === 'image' && resource.image_url && (
                  <div className="relative h-48 overflow-hidden">
                    <img 
                      src={resource.image_url} 
                      alt={resource.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-brand-600 uppercase tracking-wider">
                      Image Post
                    </div>
                  </div>
                )}
                
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex items-start justify-between mb-4">
                    <div className={cn(
                      "p-2 rounded-xl",
                      resource.resource_type === 'text' ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                    )}>
                      {resource.resource_type === 'text' ? <Type size={18} /> : <ImageIcon size={18} />}
                    </div>
                    <div className="relative">
                      <button 
                        onClick={() => setActiveMenuId(activeMenuId === resource.id ? null : resource.id)}
                        className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-50 transition-colors"
                      >
                        {isDeleting === resource.id ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <MoreVertical size={18} />
                        )}
                      </button>
                      
                      {activeMenuId === resource.id && (
                        <>
                          <div 
                            className="fixed inset-0 z-10" 
                            onClick={() => setActiveMenuId(null)}
                          />
                          <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-20 animate-in fade-in zoom-in duration-200">
                            <button 
                              onClick={() => openEditModal(resource)}
                              className="w-full px-4 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                            >
                              <Edit3 size={16} className="text-blue-500" />
                              Edit Resource
                            </button>
                            <button 
                              onClick={() => handleDeleteResource(resource)}
                              className="w-full px-4 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                            >
                              <Trash2 size={16} />
                              Delete Resource
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-brand-600 transition-colors">
                    {resource.title}
                  </h3>
                  
                  <p className="text-slate-500 text-sm line-clamp-3 mb-6 flex-1">
                    {resource.resource}
                  </p>

                  <div className="mb-6">
                    <span className="px-3 py-1 bg-brand-50 text-brand-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                      {resource.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Heart size={14} className="text-red-400" />
                      <span className="text-xs font-semibold">{resource.likeCount ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <MessageCircle size={14} className="text-brand-400" />
                      <span className="text-xs font-semibold">{resource.viewCount ?? 0}</span>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const imgUrl = authorImages[resource.authorId] ||
                          resource.authorImageUrl ||
                          (resource.authorId === currentUser?.uid ? advisorProfile?.profileImageUrl : undefined);
                        return imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={resource.author}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-[10px]">
                            {resource.author.split(' ').map(n => n[0]).join('')}
                          </div>
                        );
                      })()}
                      <div>
                        <p className="text-[10px] font-bold text-slate-800">{resource.author}</p>
                        <p className="text-[10px] text-slate-400">{resource.createdAt}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => fetchResourceInteractions(resource)}
                      className="text-brand-600 hover:text-brand-700 font-bold text-xs flex items-center gap-1 transition-colors"
                    >
                      View
                      <ExternalLink size={12} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* View Interactions Modal */}
      <AnimatePresence>
        {viewingResource && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingResource(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4 bg-slate-50/50">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-brand-500 uppercase tracking-wider mb-1">{viewingResource.category}</p>
                  <h2 className="text-xl font-bold text-slate-900 leading-snug truncate">{viewingResource.title}</h2>
                  <div className="flex items-center gap-2 mt-1 text-slate-400 text-xs">
                    <User size={11} />
                    <span>{viewingResource.author}</span>
                    <span>·</span>
                    <Calendar size={11} />
                    <span>{viewingResource.createdAt}</span>
                  </div>
                </div>
                <button
                  onClick={() => setViewingResource(null)}
                  className="p-2 hover:bg-slate-200/50 rounded-full transition-colors text-slate-400 hover:text-slate-600 flex-shrink-0"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Interaction Stats */}
              <div className="px-6 py-4 border-b border-slate-100 flex gap-6">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-red-50 rounded-xl">
                    <Heart size={16} className="text-red-500" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-800 leading-none">{resourceLikes.length}</p>
                    <p className="text-[10px] text-slate-400 font-medium">Likes</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-brand-50 rounded-xl">
                    <MessageCircle size={16} className="text-brand-500" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-800 leading-none">{resourceComments.length}</p>
                    <p className="text-[10px] text-slate-400 font-medium">Comments</p>
                  </div>
                </div>
              </div>

              {/* Scrollable content */}
              <div className="overflow-y-auto flex-1 p-6 space-y-6">
                {isLoadingInteractions ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
                    <p className="text-sm text-slate-500">Loading interactions...</p>
                  </div>
                ) : (
                  <>
                    {/* Comments Section */}
                    <div>
                      <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                        <MessageCircle size={14} className="text-brand-500" />
                        Comments
                      </h3>
                      {resourceComments.length === 0 ? (
                        <div className="text-center py-6 bg-slate-50 rounded-2xl">
                          <MessageCircle size={24} className="text-slate-300 mx-auto mb-2" />
                          <p className="text-xs text-slate-400">No comments yet</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {resourceComments.map(comment => (
                            <div key={comment.id} className="bg-slate-50 rounded-2xl p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-[10px] flex-shrink-0">
                                  {comment.userName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-slate-800">{comment.userName}</p>
                                  <p className="text-[10px] text-slate-400">{comment.createdAt}</p>
                                </div>
                              </div>
                              <p className="text-sm text-slate-600 leading-relaxed">{comment.text}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Likes Section */}
                    <div>
                      <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                        <Heart size={14} className="text-red-500" />
                        Liked by
                      </h3>
                      {resourceLikes.length === 0 ? (
                        <div className="text-center py-6 bg-slate-50 rounded-2xl">
                          <Heart size={24} className="text-slate-300 mx-auto mb-2" />
                          <p className="text-xs text-slate-400">No likes yet</p>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {resourceLikes.map(like => (
                            <div key={like.id} className="flex items-center gap-2 bg-red-50 rounded-full px-3 py-1.5">
                              <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center text-red-500 font-bold text-[9px] flex-shrink-0">
                                {like.userName ? like.userName.split(' ').map(n => n[0]).join('').slice(0, 2) : '?'}
                              </div>
                              <p className="text-[11px] font-semibold text-slate-700">
                                {like.userName || like.userId.slice(0, 8)}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Resource Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    {editingResource ? 'Edit Resource' : 'Create New Resource'}
                  </h2>
                  <p className="text-slate-500 text-sm mt-1">
                    {editingResource ? 'Update the details of your resource.' : 'Fill in the details to publish a new post.'}
                  </p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-slate-200/50 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleAddResource} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                {/* Type Selection */}
                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-700">Content Type</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setNewResource(prev => ({ ...prev, type: 'text' }))}
                      className={cn(
                        "flex items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all",
                        newResource.type === 'text' 
                          ? "border-brand-500 bg-brand-50 text-brand-600 shadow-sm shadow-brand-100" 
                          : "border-slate-100 hover:border-slate-200 text-slate-500"
                      )}
                    >
                      <Type size={20} />
                      <span className="font-semibold">Text Article</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewResource(prev => ({ ...prev, type: 'image' }))}
                      className={cn(
                        "flex items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all",
                        newResource.type === 'image' 
                          ? "border-brand-500 bg-brand-50 text-brand-600 shadow-sm shadow-brand-100" 
                          : "border-slate-100 hover:border-slate-200 text-slate-500"
                      )}
                    >
                      <ImageIcon size={20} />
                      <span className="font-semibold">Image Post</span>
                    </button>
                  </div>
                </div>

                {/* Title */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Resource Title</label>
                  <input 
                    required
                    type="text"
                    value={newResource.title}
                    onChange={e => setNewResource(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter a descriptive title..."
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-brand-500 transition-all text-slate-900"
                  />
                </div>

                {/* Category Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Category</label>
                  <div className="relative">
                    <select 
                      value={newResource.category}
                      onChange={e => setNewResource(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-brand-500 transition-all text-slate-900 appearance-none cursor-pointer pr-12"
                    >
                      {CATEGORIES.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                  </div>
                </div>

                {/* Image Upload (Conditional) */}
                {newResource.type === 'image' && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Featured Image</label>
                    <div className="relative group">
                      <input 
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                        id="image-upload"
                      />
                      <label 
                        htmlFor="image-upload"
                        className={cn(
                          "flex flex-col items-center justify-center w-full min-h-[160px] border-2 border-dashed rounded-[2rem] cursor-pointer transition-all",
                          newResource.imagePreview 
                            ? "border-brand-200 bg-brand-50/30" 
                            : "border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-brand-300"
                        )}
                      >
                        {newResource.imagePreview ? (
                          <div className="relative w-full h-full p-2">
                            <img 
                              src={newResource.imagePreview} 
                              className="w-full h-48 object-cover rounded-2xl shadow-md"
                              alt="Preview"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                              <p className="text-white font-bold flex items-center gap-2">
                                <Upload size={18} /> Change Image
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center py-6">
                            <div className="p-4 bg-white rounded-2xl shadow-sm text-brand-500 mb-3 group-hover:scale-110 transition-transform">
                              <Upload size={24} />
                            </div>
                            <p className="text-sm font-semibold text-slate-700">Click to upload or drag and drop</p>
                            <p className="text-xs text-slate-400 mt-1">PNG, JPG or WebP (max. 5MB)</p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>
                )}

                {/* Content */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">
                    {newResource.type === 'text' ? 'Article Content' : 'Description'}
                  </label>
                  <textarea 
                    required
                    rows={6}
                    value={newResource.content}
                    onChange={e => setNewResource(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Write your content here..."
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-brand-500 transition-all text-slate-900 resize-none"
                  />
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPublishing || isUploading}
                    className="flex-[2] px-6 py-4 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white font-bold rounded-2xl shadow-lg shadow-brand-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 size={20} className="animate-spin" />
                        Uploading...
                      </>
                    ) : isPublishing ? (
                      <>
                        <Loader2 size={20} className="animate-spin" />
                        {editingResource ? 'Saving Changes...' : 'Publishing...'}
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={20} />
                        {editingResource ? 'Save Changes' : 'Publish Resource'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
