import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { generateSummary, getFaviconUrl, getPageTitle } from '../lib/utils';
import { PlusIcon, TrashIcon, ExternalLinkIcon, MoonIcon, SunIcon, TagIcon, XIcon } from 'lucide-react';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null); // Track which bookmark is being deleted
  const [signingOut, setSigningOut] = useState(false); // Track sign out loading
  const [newUrl, setNewUrl] = useState('');
  const [newTags, setNewTags] = useState('');
  const [error, setError] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [draggedItem, setDraggedItem] = useState(null);

  const fetchBookmarks = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('bookmarks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBookmarks(data || []);
    } catch (error) {
      console.error('Error fetching bookmarks:', error);
      setError('Failed to load bookmarks');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      fetchBookmarks();
    }
  }, [user, fetchBookmarks]);

  useEffect(() => {
    // Extract all unique tags from bookmarks
    const tags = new Set();
    bookmarks.forEach(bookmark => {
      if (bookmark.tags) {
        bookmark.tags.forEach(tag => tags.add(tag));
      }
    });
    setAvailableTags(Array.from(tags));
  }, [bookmarks]);

  const addBookmark = async (e) => {
    e.preventDefault();
    if (!newUrl.trim()) return;

    setSaving(true);
    setError('');

    // Clear form immediately for better UX
    const urlToSave = newUrl;
    const tagsToSave = newTags;
    setNewUrl('');
    setNewTags('');

    try {
      // Validate URL
      const url = new URL(urlToSave.startsWith('http') ? urlToSave : `https://${urlToSave}`);
      
      // Process tags
      const tags = tagsToSave
        .split(',')
        .map(tag => tag.trim().toLowerCase())
        .filter(tag => tag.length > 0);
      
      // Show optimistic placeholder
      const tempId = Date.now();
      const placeholderBookmark = {
        id: tempId,
        url: url.href,
        title: 'Loading...',
        summary: 'Generating summary...',
        favicon: getFaviconUrl(url.href),
        tags,
        created_at: new Date().toISOString(),
        isLoading: true
      };
      
      setBookmarks(prev => [placeholderBookmark, ...prev]);

      // Get page title and generate summary in parallel
      const [title, summary] = await Promise.all([
        getPageTitle(url.href).catch(() => url.href),
        generateSummary(url.href).catch(() => 'Could not generate summary for this page.')
      ]);

      const { data, error } = await supabase
        .from('bookmarks')
        .insert([
          {
            user_id: user.id,
            url: url.href,
            title,
            summary,
            favicon: getFaviconUrl(url.href),
            tags,
          },
        ])
        .select();

      if (error) throw error;

      // Replace placeholder with real data
      setBookmarks(prev => prev.map(bookmark => 
        bookmark.id === tempId ? data[0] : bookmark
      ));

    } catch (error) {
      console.error('Error adding bookmark:', error);
      setError('Failed to add bookmark. Please check the URL.');
      
      // Restore form values on error
      setNewUrl(urlToSave);
      setNewTags(tagsToSave);
      
      // Remove placeholder bookmark on error
      setBookmarks(prev => prev.filter(bookmark => !bookmark.isLoading));
    } finally {
      setSaving(false);
    }
  };

  const deleteBookmark = async (id) => {
    setDeleting(id);
    setError('');
    
    try {
      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      // Optimistically update UI
      setBookmarks(prevBookmarks => prevBookmarks.filter(bookmark => bookmark.id !== id));
    } catch (error) {
      console.error('Error deleting bookmark:', error);
      setError('Failed to delete bookmark');
    } finally {
      setDeleting(null);
    }
  };

  const toggleTagFilter = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const clearTagFilters = () => {
    setSelectedTags([]);
  };

  // Filter bookmarks based on selected tags
  const filteredBookmarks = selectedTags.length === 0 
    ? bookmarks 
    : bookmarks.filter(bookmark => 
        bookmark.tags && bookmark.tags.some(tag => selectedTags.includes(tag))
      );

  // Drag and drop handlers
  const handleDragStart = (e, bookmark) => {
    setDraggedItem(bookmark);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetBookmark) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem.id === targetBookmark.id) {
      setDraggedItem(null);
      return;
    }

    const draggedIndex = filteredBookmarks.findIndex(b => b.id === draggedItem.id);
    const targetIndex = filteredBookmarks.findIndex(b => b.id === targetBookmark.id);

    const newBookmarks = [...filteredBookmarks];
    const [movedBookmark] = newBookmarks.splice(draggedIndex, 1);
    newBookmarks.splice(targetIndex, 0, movedBookmark);

    setBookmarks(newBookmarks);
    setDraggedItem(null);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      setError('Failed to sign out');
    } finally {
      setSigningOut(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <div className="text-lg text-gray-600 dark:text-gray-400">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Link Saver</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? <SunIcon size={20} /> : <MoonIcon size={20} />}
            </button>
            <span className="text-gray-600 dark:text-gray-300">Welcome, {user?.email}</span>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className={`transition-colors flex items-center gap-2 ${
                signingOut 
                  ? 'text-gray-400 cursor-not-allowed' 
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {signingOut ? (
                <>
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                  Signing out...
                </>
              ) : (
                'Sign Out'
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Add Bookmark Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-8 transition-colors duration-200">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Add New Bookmark</h2>
          <form onSubmit={addBookmark} className="space-y-4">
            <div className="flex gap-4">
              <input
                type="text"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="Enter URL (e.g., https://example.com)"
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                disabled={saving}
              />
              <button
                type="submit"
                disabled={saving || !newUrl.trim()}
                className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                <PlusIcon size={16} />
                {saving ? 'Adding...' : 'Add'}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <TagIcon size={16} className="text-gray-500 dark:text-gray-400" />
              <input
                type="text"
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
                placeholder="Tags (comma separated, e.g., work, articles, tools)"
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                disabled={saving}
              />
            </div>
          </form>
          {error && (
            <p className="mt-2 text-red-600 dark:text-red-400 text-sm">{error}</p>
          )}
        </div>

        {/* Tag Filters */}
        {availableTags.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-8 transition-colors duration-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Filter by Tags</h2>
              {selectedTags.length > 0 && (
                <button
                  onClick={clearTagFilters}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1"
                >
                  <XIcon size={14} />
                  Clear filters
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {availableTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTagFilter(tag)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    selectedTags.includes(tag)
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bookmarks List */}
        <div className="space-y-4">
          {filteredBookmarks.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center transition-colors duration-200">
              <p className="text-gray-500 dark:text-gray-400 text-lg">
                {selectedTags.length > 0 ? 'No bookmarks match the selected tags.' : 'No bookmarks yet.'}
              </p>
              <p className="text-gray-400 dark:text-gray-500 mt-2">
                {selectedTags.length > 0 ? 'Try different tags or clear filters.' : 'Add your first bookmark above!'}
              </p>
            </div>
          ) : (
            <>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                💡 Tip: Drag bookmarks to reorder them
              </div>
              {filteredBookmarks.map((bookmark) => (
                <div 
                  key={bookmark.id} 
                  className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-all duration-200 ${
                    bookmark.isLoading ? 'opacity-75' : 'cursor-move hover:shadow-md'
                  }`}
                  draggable={!bookmark.isLoading}
                  onDragStart={(e) => !bookmark.isLoading && handleDragStart(e, bookmark)}
                  onDragOver={!bookmark.isLoading ? handleDragOver : undefined}
                  onDrop={(e) => !bookmark.isLoading && handleDrop(e, bookmark)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex items-center gap-3 mb-2">
                        <Image
                          src={bookmark.favicon}
                          alt=""
                          width={20}
                          height={20}
                          className="w-5 h-5 flex-shrink-0"
                          onError={(e) => {
                            e.currentTarget.src = '/favicon.ico';
                          }}
                        />
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate flex items-center gap-2">
                          {bookmark.title}
                          {bookmark.isLoading && (
                            <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                          )}
                        </h3>
                      </div>
                      <a
                        href={bookmark.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 text-sm flex items-center gap-1 mb-3 transition-colors break-all"
                      >
                        <span className="truncate">{bookmark.url}</span>
                        <ExternalLinkIcon size={12} className="flex-shrink-0" />
                      </a>
                      <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-3 break-words whitespace-pre-wrap">
                        {bookmark.isLoading ? (
                          <span className="flex items-center gap-2">
                            {bookmark.summary}
                            <div className="w-3 h-3 border border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                          </span>
                        ) : (
                          bookmark.summary
                        )}
                      </p>
                      {bookmark.tags && bookmark.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {bookmark.tags.map(tag => (
                            <span
                              key={tag}
                              className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-gray-400 dark:text-gray-500 text-xs">
                        Added {new Date(bookmark.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteBookmark(bookmark.id)}
                      disabled={deleting === bookmark.id || bookmark.isLoading}
                      className={`p-2 transition-colors flex-shrink-0 ${
                        deleting === bookmark.id || bookmark.isLoading
                          ? 'text-gray-400 cursor-not-allowed' 
                          : 'text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300'
                      }`}
                      title={deleting === bookmark.id ? 'Deleting...' : bookmark.isLoading ? 'Processing...' : 'Delete bookmark'}
                    >
                      {deleting === bookmark.id ? (
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                      ) : (
                        <TrashIcon size={16} />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
