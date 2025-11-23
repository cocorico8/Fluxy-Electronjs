const { shell } = require('electron');

// State
let games = [];
let filteredGames = [];
let currentView = 'games';
let gridViewMode = 'grid';
let searchQuery = '';
let selectedGenre = '';
let sortBy = 'recent';

// Agent State
let agentLang = null;
let agentContext = null;
let agentData = {};

// API Configuration
const API_URL = 'https://fluxyrepacks.xyz/api/games';
const AGENT_API_URL = 'https://agent.fluxyrepacks.xyz';

// DOM Elements - Existing
const gamesGrid = document.getElementById('games-grid');
const loading = document.getElementById('loading');
const errorMessage = document.getElementById('error-message');
const refreshBtn = document.getElementById('refresh-btn');
const gameDetailModal = document.getElementById('game-detail-modal');
const gameDetailContent = document.getElementById('game-detail-content');
const visitWebsiteBtn = document.getElementById('visit-website');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search');
const genreFilter = document.getElementById('genre-filter');
const sortFilter = document.getElementById('sort-filter');
const toggleViewBtn = document.getElementById('toggle-view');
const viewIcon = document.getElementById('view-icon');
const gamesCount = document.getElementById('games-count');
const noResults = document.getElementById('no-results');
const resetFiltersBtn = document.getElementById('reset-filters');

// DOM Elements - Agent
const agentToggle = document.getElementById('agent-toggle');
const agentPanel = document.getElementById('agent-panel');
const agentClose = document.getElementById('agent-close');
const langSelection = document.getElementById('lang-selection');
const agentContent = document.getElementById('agent-content');
const agentMessages = document.getElementById('agent-messages');
const agentOptions = document.getElementById('agent-options');
const agentInputArea = document.getElementById('agent-input-area');
const agentInput = document.getElementById('agent-input');
const agentSend = document.getElementById('agent-send');
const agentBack = document.getElementById('agent-back');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    setupAgentListeners();
    fetchGames();
});

// Event Listeners
function setupEventListeners() {
    // Menu navigation
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            switchView(view);
        });
    });

    refreshBtn.addEventListener('click', fetchGames);
    visitWebsiteBtn.addEventListener('click', () => {
        shell.openExternal('https://fluxyrepacks.xyz');
    });

    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        clearSearchBtn.style.display = searchQuery ? 'flex' : 'none';
        applyFilters();
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        applyFilters();
    });

    genreFilter.addEventListener('change', (e) => {
        selectedGenre = e.target.value;
        applyFilters();
    });

    sortFilter.addEventListener('change', (e) => {
        sortBy = e.target.value;
        applyFilters();
    });

    toggleViewBtn.addEventListener('click', () => {
        const modes = ['grid', 'compact', 'list'];
        const currentIndex = modes.indexOf(gridViewMode);
        gridViewMode = modes[(currentIndex + 1) % modes.length];
        updateViewMode();
    });

    resetFiltersBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        selectedGenre = '';
        sortBy = 'recent';
        genreFilter.value = '';
        sortFilter.value = 'recent';
        clearSearchBtn.style.display = 'none';
        applyFilters();
    });

    document.querySelector('.modal-close').addEventListener('click', closeModal);
    gameDetailModal.addEventListener('click', (e) => {
        if (e.target === gameDetailModal) {
            closeModal();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            if (agentPanel.classList.contains('active')) {
                closeAgent();
            }
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            searchInput.focus();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
            e.preventDefault();
            fetchGames();
        }
    });
}

// Agent Event Listeners
function setupAgentListeners() {
    agentToggle.addEventListener('click', toggleAgent);
    agentClose.addEventListener('click', closeAgent);

    // Language selection
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            agentLang = btn.dataset.lang;
            initAgent();
        });
    });

    // Send message
    agentSend.addEventListener('click', sendAgentMessage);
    agentInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendAgentMessage();
        }
    });

    // Back button
    agentBack.addEventListener('click', () => {
        showAgentOptions();
    });
}

// Agent Functions
function toggleAgent() {
    agentPanel.classList.toggle('active');
    if (agentPanel.classList.contains('active') && !agentLang) {
        showLanguageSelection();
    }
}

function closeAgent() {
    agentPanel.classList.remove('active');
}

function showLanguageSelection() {
    langSelection.style.display = 'block';
    agentContent.style.display = 'none';
}

async function initAgent() {
    langSelection.style.display = 'none';
    agentContent.style.display = 'flex';
    
    agentMessages.innerHTML = '';
    agentOptions.innerHTML = '';
    
    try {
        const response = await fetch(`${AGENT_API_URL}/agent/options?lang=${agentLang}`);
        const data = await response.json();
        
        addAgentMessage(data.greeting, 'bot');
        displayAgentOptions(data.options);
    } catch (error) {
        addAgentMessage('Error connecting to agent service. Please try again.', 'error');
    }
}

function addAgentMessage(text, type = 'bot') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `agent-message ${type}`;
    messageDiv.textContent = text;
    agentMessages.appendChild(messageDiv);
    agentMessages.scrollTop = agentMessages.scrollHeight;
}

function displayAgentOptions(options) {
    agentOptions.innerHTML = '';
    agentInputArea.style.display = 'none';
    
    options.forEach(option => {
        const btn = document.createElement('button');
        btn.className = 'agent-option-btn';
        btn.textContent = option.label;
        btn.addEventListener('click', () => handleAgentOption(option));
        agentOptions.appendChild(btn);
    });
}

async function handleAgentOption(option) {
    agentContext = option.id;
    agentOptions.innerHTML = '';
    
    switch (option.type) {
        case 'search':
            showSearchInput();
            break;
        case 'genre':
            await showGenreList();
            break;
        case 'action':
            await handleAgentAction(option.id);
            break;
        case 'report':
            showReportForm();
            break;
        case 'suggest':
            showSuggestForm();
            break;
    }
}

function showSearchInput() {
    const msg = agentLang === 'fr' 
        ? 'Entrez le nom du jeu que vous recherchez :' 
        : 'Enter the name of the game you are looking for:';
    
    addAgentMessage(msg, 'bot');
    agentInputArea.style.display = 'flex';
    agentInput.placeholder = agentLang === 'fr' ? 'Nom du jeu...' : 'Game name...';
    agentInput.focus();
}

async function showGenreList() {
    addAgentMessage(agentLang === 'fr' ? 'Chargement des genres...' : 'Loading genres...', 'bot');
    
    try {
        const response = await fetch(`${AGENT_API_URL}/agent/genres?lang=${agentLang}`);
        const data = await response.json();
        
        if (data.success) {
            agentMessages.lastChild.remove();
            addAgentMessage(data.message, 'bot');
            
            data.genres.forEach(genre => {
                const btn = document.createElement('button');
                btn.className = 'agent-option-btn';
                btn.textContent = `🎯 ${genre}`;
                btn.addEventListener('click', () => searchByGenre(genre));
                agentOptions.appendChild(btn);
            });
        }
    } catch (error) {
        addAgentMessage('Error loading genres', 'error');
    }
}

async function handleAgentAction(action) {
    const endpoints = {
        'most_downloaded': '/agent/most-downloaded',
        'most_viewed': '/agent/most-viewed',
        'recent_games': '/agent/recent'
    };
    
    const msg = agentLang === 'fr' ? 'Chargement...' : 'Loading...';
    addAgentMessage(msg, 'bot');
    
    try {
        const response = await fetch(`${AGENT_API_URL}${endpoints[action]}?lang=${agentLang}`);
        const data = await response.json();
        
        if (data.success) {
            agentMessages.lastChild.remove();
            addAgentMessage(data.message, 'bot');
            displayGameResults(data.results);
        }
    } catch (error) {
        addAgentMessage('Error loading data', 'error');
    }
}

async function sendAgentMessage() {
    const query = agentInput.value.trim();
    if (!query) return;
    
    addAgentMessage(query, 'user');
    agentInput.value = '';
    agentInputArea.style.display = 'none';
    
    const msg = agentLang === 'fr' ? 'Recherche en cours...' : 'Searching...';
    addAgentMessage(msg, 'bot');
    
    try {
        const response = await fetch(`${AGENT_API_URL}/agent/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, lang: agentLang })
        });
        
        const data = await response.json();
        
        if (data.success) {
            agentMessages.lastChild.remove();
            addAgentMessage(data.message, 'bot');
            
            if (data.results.length > 0) {
                displayGameResults(data.results);
            }
        }
    } catch (error) {
        addAgentMessage('Search error', 'error');
    }
}

async function searchByGenre(genre) {
    agentOptions.innerHTML = '';
    
    const msg = agentLang === 'fr' ? 'Recherche en cours...' : 'Searching...';
    addAgentMessage(msg, 'bot');
    
    try {
        const response = await fetch(`${AGENT_API_URL}/agent/genre`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ genre, lang: agentLang })
        });
        
        const data = await response.json();
        
        if (data.success) {
            agentMessages.lastChild.remove();
            addAgentMessage(data.message, 'bot');
            
            if (data.results.length > 0) {
                displayGameResults(data.results);
            }
        }
    } catch (error) {
        addAgentMessage('Search error', 'error');
    }
}

function displayGameResults(results) {
    results.forEach(game => {
        const resultDiv = document.createElement('div');
        resultDiv.className = 'agent-game-result';
        
        const titleDiv = document.createElement('div');
        titleDiv.className = 'agent-game-result-title';
        titleDiv.textContent = game.name;
        
        const descDiv = document.createElement('div');
        descDiv.className = 'agent-game-result-desc';
        descDiv.textContent = game.description;
        
        const metaDiv = document.createElement('div');
        metaDiv.className = 'agent-game-result-meta';
        metaDiv.innerHTML = `
            <span>👁️ ${game.views}</span>
            <span>⬇️ ${game.downloads}</span>
            <span>📦 ${game.size}</span>
        `;
        
        const genresDiv = document.createElement('div');
        genresDiv.className = 'agent-genres';
        game.genre.slice(0, 3).forEach(g => {
            const tag = document.createElement('span');
            tag.className = 'agent-genre-tag';
            tag.textContent = g;
            genresDiv.appendChild(tag);
        });
        
        resultDiv.appendChild(titleDiv);
        resultDiv.appendChild(descDiv);
        resultDiv.appendChild(metaDiv);
        resultDiv.appendChild(genresDiv);
        
        resultDiv.addEventListener('click', () => {
            const fullGame = games.find(g => g._id === game._id);
            if (fullGame) {
                closeAgent();
                showGameDetail(fullGame);
            }
        });
        
        agentOptions.appendChild(resultDiv);
    });
    
    addBackButton();
}

function showReportForm() {
    const labels = {
        en: {
            title: 'Report a broken link',
            gameName: 'Game name',
            gameId: 'Game ID (optional)',
            link: 'Broken link URL',
            comment: 'Additional comment',
            submit: 'Send report'
        },
        fr: {
            title: 'Signaler un lien mort',
            gameName: 'Nom du jeu',
            gameId: 'ID du jeu (optionnel)',
            link: 'URL du lien mort',
            comment: 'Commentaire additionnel',
            submit: 'Envoyer le rapport'
        }
    };
    
    const l = labels[agentLang];
    
    addAgentMessage(l.title, 'bot');
    
    const form = document.createElement('div');
    form.innerHTML = `
        <div class="agent-form-group">
            <label>${l.gameName}</label>
            <input type="text" id="report-game-name" required>
        </div>
        <div class="agent-form-group">
            <label>${l.gameId}</label>
            <input type="text" id="report-game-id">
        </div>
        <div class="agent-form-group">
            <label>${l.link}</label>
            <input type="url" id="report-link-url">
        </div>
        <div class="agent-form-group">
            <label>${l.comment}</label>
            <textarea id="report-comment"></textarea>
        </div>
        <button class="agent-submit-btn" id="submit-report">${l.submit}</button>
    `;
    
    agentOptions.appendChild(form);
    
    document.getElementById('submit-report').addEventListener('click', async () => {
        const data = {
            gameName: document.getElementById('report-game-name').value,
            gameId: document.getElementById('report-game-id').value,
            linkUrl: document.getElementById('report-link-url').value,
            userComment: document.getElementById('report-comment').value,
            lang: agentLang
        };
        
        if (!data.gameName) {
            addAgentMessage(agentLang === 'fr' ? 'Veuillez entrer le nom du jeu' : 'Please enter the game name', 'error');
            return;
        }
        
        try {
            const response = await fetch(`${AGENT_API_URL}/agent/report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (result.success) {
                agentOptions.innerHTML = '';
                addAgentMessage(result.message, 'success');
                addBackButton();
            }
        } catch (error) {
            addAgentMessage('Error sending report', 'error');
        }
    });
    
    addBackButton();
}

function showSuggestForm() {
    const labels = {
        en: {
            title: 'Suggest a game',
            gameName: 'Game name',
            link: 'Game link (Steam, official website, etc.)',
            description: 'Description or additional information',
            submit: 'Send suggestion'
        },
        fr: {
            title: 'Proposer un jeu',
            gameName: 'Nom du jeu',
            link: 'Lien du jeu (Steam, site officiel, etc.)',
            description: 'Description ou informations supplémentaires',
            submit: 'Envoyer la suggestion'
        }
    };
    
    const l = labels[agentLang];
    
    addAgentMessage(l.title, 'bot');
    
    const form = document.createElement('div');
    form.innerHTML = `
        <div class="agent-form-group">
            <label>${l.gameName}</label>
            <input type="text" id="suggest-game-name" required>
        </div>
        <div class="agent-form-group">
            <label>${l.link}</label>
            <input type="url" id="suggest-game-link">
        </div>
        <div class="agent-form-group">
            <label>${l.description}</label>
            <textarea id="suggest-description"></textarea>
        </div>
        <button class="agent-submit-btn" id="submit-suggest">${l.submit}</button>
    `;
    
    agentOptions.appendChild(form);
    
    document.getElementById('submit-suggest').addEventListener('click', async () => {
        const data = {
            gameName: document.getElementById('suggest-game-name').value,
            gameLink: document.getElementById('suggest-game-link').value,
            description: document.getElementById('suggest-description').value,
            lang: agentLang
        };
        
        if (!data.gameName) {
            addAgentMessage(agentLang === 'fr' ? 'Veuillez entrer le nom du jeu' : 'Please enter the game name', 'error');
            return;
        }
        
        try {
            const response = await fetch(`${AGENT_API_URL}/agent/suggest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (result.success) {
                agentOptions.innerHTML = '';
                addAgentMessage(result.message, 'success');
                addBackButton();
            }
        } catch (error) {
            addAgentMessage('Error sending suggestion', 'error');
        }
    });
    
    addBackButton();
}

function addBackButton() {
    const backBtn = document.createElement('button');
    backBtn.className = 'agent-option-btn';
    backBtn.textContent = agentLang === 'fr' ? '← Retour au menu' : '← Back to menu';
    backBtn.addEventListener('click', showAgentOptions);
    agentOptions.appendChild(backBtn);
}

function showAgentOptions() {
    initAgent();
}

// Existing Functions (unchanged)
function switchView(view) {
    currentView = view;
    
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === view);
    });

    document.querySelectorAll('.view').forEach(v => {
        v.classList.toggle('active', v.id === `${view}-view`);
    });
}

async function fetchGames() {
    loading.style.display = 'block';
    errorMessage.style.display = 'none';
    gamesGrid.innerHTML = '';

    try {
        const response = await fetch(API_URL, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success && data.data && data.data.games) {
            games = data.data.games;
            populateGenreFilter();
            applyFilters();
        } else {
            throw new Error('Invalid data format');
        }
    } catch (error) {
        console.error('Loading error:', error);
        showError(`Unable to load games: ${error.message}`);
    } finally {
        loading.style.display = 'none';
    }
}

function populateGenreFilter() {
    const genres = new Set();
    games.forEach(game => {
        game.genre.forEach(g => genres.add(g));
    });

    const sortedGenres = Array.from(genres).sort();
    
    genreFilter.innerHTML = '<option value="">All Genres</option>';
    sortedGenres.forEach(genre => {
        const option = document.createElement('option');
        option.value = genre;
        option.textContent = genre;
        genreFilter.appendChild(option);
    });
}

function applyFilters() {
    let filtered = [...games];

    if (searchQuery) {
        filtered = filtered.filter(game => 
            game.name.toLowerCase().includes(searchQuery) ||
            game.description.toLowerCase().includes(searchQuery) ||
            game.cracker.toLowerCase().includes(searchQuery) ||
            game.genre.some(g => g.toLowerCase().includes(searchQuery))
        );
    }

    if (selectedGenre) {
        filtered = filtered.filter(game => 
            game.genre.includes(selectedGenre)
        );
    }

    filtered.sort((a, b) => {
        switch (sortBy) {
            case 'views':
                return b.views - a.views;
            case 'downloads':
                return b.downloads - a.downloads;
            case 'name':
                return a.name.localeCompare(b.name);
            case 'size':
                return parseSize(b.size) - parseSize(a.size);
            case 'recent':
            default:
                return new Date(b.dateAdded) - new Date(a.dateAdded);
        }
    });

    filteredGames = filtered;
    updateGamesCount();
    displayGames(filtered);
}

function parseSize(sizeStr) {
    const match = sizeStr.match(/(\d+\.?\d*)\s*(gb|mb|kb)/i);
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    
    switch (unit) {
        case 'gb': return value * 1024 * 1024;
        case 'mb': return value * 1024;
        case 'kb': return value;
        default: return value;
    }
}

function updateGamesCount() {
    gamesCount.textContent = `(${filteredGames.length}${filteredGames.length !== games.length ? ` / ${games.length}` : ''})`;
}

function updateViewMode() {
    gamesGrid.className = 'games-grid';
    
    switch (gridViewMode) {
        case 'list':
            gamesGrid.classList.add('list-view');
            viewIcon.textContent = '☰';
            break;
        case 'compact':
            gamesGrid.classList.add('compact-view');
            viewIcon.textContent = '▦';
            break;
        case 'grid':
        default:
            viewIcon.textContent = '▦';
            break;
    }
}

function displayGames(gamesArray) {
    gamesGrid.innerHTML = '';
    noResults.style.display = 'none';

    if (gamesArray.length === 0) {
        noResults.style.display = 'block';
        return;
    }

    gamesArray.forEach(game => {
        const card = createGameCard(game);
        gamesGrid.appendChild(card);
    });
}

function createGameCard(game) {
    const card = document.createElement('div');
    card.className = 'game-card';
    
    const imageUrl = game.imageUrl ? `http://${game.imageUrl}` : '';
    
    card.innerHTML = `
        <div class="game-card-inner">
            <img src="${imageUrl}" alt="${game.name}" class="game-image" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22160%22><rect width=%22120%22 height=%22160%22 fill=%22%23333%22/><text x=%2250%%22 y=%2250%%22 fill=%22%23666%22 font-size=%2214%22 text-anchor=%22middle%22>No Image</text></svg>'">
            <div class="game-info">
                <h3 class="game-title">${escapeHtml(game.name)}</h3>
                <p class="game-description">${escapeHtml(game.description)}</p>
                <div class="game-stats">
                    <span>👁️ ${game.views}</span>
                    <span>⬇️ ${game.downloads}</span>
                </div>
                <div class="game-meta">
                    <span>📦 ${game.size}</span>
                    <span>🔖 v${game.version}</span>
                </div>
                <div class="game-genres">
                    ${game.genre.slice(0, 3).map(g => `<span class="genre-tag">${g}</span>`).join('')}
                </div>
                <div class="game-cracker">Cracker: ${game.cracker}</div>
            </div>
        </div>
    `;

    card.addEventListener('click', () => showGameDetail(game));

    return card;
}

function showGameDetail(game) {
    const imageUrl = game.imageUrl ? `http://${game.imageUrl}` : '';
    
    const screenshotsHtml = game.screenshotUrls && game.screenshotUrls.length > 0
        ? `
            <div class="detail-section">
                <h3>Screenshots</h3>
                <div class="screenshots-scroll">
                    ${game.screenshotUrls.map(url => `
                        <img src="http://${url}" class="screenshot-img" alt="Screenshot" 
                             onerror="this.style.display='none'">
                    `).join('')}
                </div>
            </div>
        `
        : '';

    const linksHtml = game.links && game.links.length > 0
        ? `
            <h4 style="color: #fff; margin-bottom: 10px;">Direct links:</h4>
            ${game.links.map(link => `
                <a href="#" class="download-link" data-url="${link}">
                    <span>🔗</span>
                    <span>${extractDomain(link)}</span>
                </a>
            `).join('')}
        `
        : '';

    const torrentsHtml = game.torrentLinks && game.torrentLinks.length > 0
        ? `
            <h4 style="color: #fff; margin: 20px 0 10px;">Torrents:</h4>
            ${game.torrentLinks.map(torrent => `
                <a href="#" class="download-link torrent" data-magnet="magnet:?xt=urn:btih:${torrent}">
                    <span>🌪️</span>
                    <span>Open with torrent client</span>
                </a>
            `).join('')}
        `
        : '';

    gameDetailContent.innerHTML = `
        <img src="${imageUrl}" alt="${game.name}" class="detail-image" 
             onerror="this.style.display='none'">
        
        <h1 class="detail-title">${escapeHtml(game.name)}</h1>
        
        <div class="detail-stats">
            <span>👁️ ${game.views} views</span>
            <span>⬇️ ${game.downloads} downloads</span>
        </div>

        <div class="detail-section">
            <h3>Description</h3>
            <p class="detail-description">${escapeHtml(game.description)}</p>
        </div>

        <div class="detail-section">
            <div class="detail-info-grid">
                <div class="info-item">
                    <span class="info-label">Size:</span>
                    <span class="info-value">${game.size}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Version:</span>
                    <span class="info-value">${game.version}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Cracker:</span>
                    <span class="info-value">${game.cracker}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Author:</span>
                    <span class="info-value">${game.author.username}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Steam ID:</span>
                    <span class="info-value">${game.steamId || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Online:</span>
                    <span class="info-value">${game.isOnline ? 'Yes' : 'No'}</span>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h3>Genres</h3>
            <div class="game-genres">
                ${game.genre.map(g => `<span class="genre-tag">${g}</span>`).join('')}
            </div>
        </div>

        ${screenshotsHtml}

        <div class="detail-section download-section">
            <h3>Downloads</h3>
            <div class="download-links">
                ${linksHtml || torrentsHtml ? linksHtml + torrentsHtml : '<p style="color: #777; font-style: italic;">No download links available</p>'}
            </div>
        </div>
    `;

    gameDetailContent.querySelectorAll('.download-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const url = link.dataset.url || link.dataset.magnet;
            if (url) {
                shell.openExternal(url);
            }
        });
    });

    gameDetailModal.classList.add('active');
}

function closeModal() {
    gameDetailModal.classList.remove('active');
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function extractDomain(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch {
        return 'Download';
    }
}