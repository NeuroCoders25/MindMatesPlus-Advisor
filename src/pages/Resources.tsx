import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Image as ImageIcon, 
  Type, 
  MoreVertical, 
  Trash2, 
  Edit3, 
  ExternalLink,
  X,
  Upload,
  CheckCircle2,
  Calendar,
  User,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface Resource {
  id: string;
  title: string;
  type: 'text' | 'image';
  content: string;
  imageUrl?: string;
  author: string;
  date: string;
  category: string;
}

const CATEGORIES = [
  'Wellness - Thriving',
  'Wellness - Stress Aware',
  'Wellness - Emotionally Aware',
  'Mild Support',
  'Recovery & Improvement',
  'Moderate Support'
];

const mockResources: Resource[] = [
  {
    id: '1',
    title: 'Managing Anxiety in Daily Life',
    type: 'text',
    content: 'Anxiety is a normal part of life, but it can become overwhelming...',
    author: 'Dr. Sarah Smith',
    date: '2024-05-10',
    category: 'Wellness - Stress Aware'
  },
  {
    id: '2',
    title: 'Morning Meditation Routine',
    type: 'image',
    content: 'A visual guide to starting your day with mindfulness.',
    imageUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=800',
    author: 'James Wilson',
    date: '2024-05-08',
    category: 'Wellness - Thriving'
  },
  {
    id: '3',
    title: 'Cognitive Behavioral Therapy Basics',
    type: 'text',
    content: 'CBT is a common type of talk therapy (psychotherapy)...',
    author: 'Dr. Emily Brown',
    date: '2024-05-05',
    category: 'Mild Support'
  }
];

export default function Resources() {
  const [resources, setResources] = useState<Resource[]>(mockResources);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'text' | 'image'>('all');
  
  // New Resource Form State
  const [newResource, setNewResource] = useState({
    title: '',
    type: 'text' as 'text' | 'image',
    content: '',
    category: CATEGORIES[0],
    image: null as File | null,
    imagePreview: ''
  });

  const filteredResources = resources.filter(res => {
    const matchesSearch = res.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         res.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || res.type === filterType;
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

  const handleAddResource = (e: React.FormEvent) => {
    e.preventDefault();
    const resource: Resource = {
      id: Math.random().toString(36).substr(2, 9),
      title: newResource.title,
      type: newResource.type,
      content: newResource.content,
      imageUrl: newResource.imagePreview || undefined,
      author: 'Current Advisor', // Should come from context
      date: new Date().toISOString().split('T')[0],
      category: newResource.category
    };
    setResources([resource, ...resources]);
    setIsModalOpen(false);
    setNewResource({ title: '', type: 'text', content: '', category: CATEGORIES[0], image: null, imagePreview: '' });
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
          onClick={() => setIsModalOpen(true)}
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
              {resource.type === 'image' && resource.imageUrl && (
                <div className="relative h-48 overflow-hidden">
                  <img 
                    src={resource.imageUrl} 
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
                    resource.type === 'text' ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                  )}>
                    {resource.type === 'text' ? <Type size={18} /> : <ImageIcon size={18} />}
                  </div>
                  <button className="text-slate-400 hover:text-slate-600 p-1">
                    <MoreVertical size={18} />
                  </button>
                </div>

                <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-brand-600 transition-colors">
                  {resource.title}
                </h3>
                
                <p className="text-slate-500 text-sm line-clamp-3 mb-6 flex-1">
                  {resource.content}
                </p>

                <div className="mb-6">
                  <span className="px-3 py-1 bg-brand-50 text-brand-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                    {resource.category}
                  </span>
                </div>

                <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-[10px]">
                      {resource.author.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-800">{resource.author}</p>
                      <p className="text-[10px] text-slate-400">{resource.date}</p>
                    </div>
                  </div>
                  <button className="text-brand-600 hover:text-brand-700 font-bold text-xs flex items-center gap-1 transition-colors">
                    View
                    <ExternalLink size={12} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

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
                  <h2 className="text-2xl font-bold text-slate-900">Create New Resource</h2>
                  <p className="text-slate-500 text-sm mt-1">Fill in the details to publish a new post.</p>
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
                    className="flex-[2] px-6 py-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl shadow-lg shadow-brand-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={20} />
                    Publish Resource
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
