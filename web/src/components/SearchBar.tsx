import React from 'react';

interface SearchBarProps {
  onSearch: (term: string) => void;
  searchTerm: string;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, searchTerm: externalSearchTerm }) => {
  const [searchTerm, setSearchTerm] = React.useState(externalSearchTerm);

  React.useEffect(() => {
    setSearchTerm(externalSearchTerm);
  }, [externalSearchTerm]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchTerm);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    // Auto-search as user types (debounced)
    clearTimeout((window as any).searchTimeout);
    (window as any).searchTimeout = setTimeout(() => {
      onSearch(value);
    }, 300);
  };

  const handleClear = () => {
    setSearchTerm('');
    onSearch('');
  };

  return (
    <div className="search-bar">
      <form onSubmit={handleSubmit}>
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            value={searchTerm}
            onChange={handleChange}
            placeholder="Search mods by title, description, or creator..."
            className="search-input"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={handleClear}
              className="search-clear"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default SearchBar;
