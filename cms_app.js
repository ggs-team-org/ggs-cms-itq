/* ==========================================================================
   CONFIG
   ========================================================================== */

const CONFIG = {
    API: {
        GET_POST: 'https://ggs.pmg.net/spe/functions/CMS Get Single Post Info',
        FILTER_POSTS: 'https://ggs.pmg.net/spe/functions/cms Get Posts with Filters',
        GET_COMMENTS: 'https://ggs.pmg.net/spe/functions/CMS%20Get%20Post%20Comments',
        ADD_REACTION: 'https://ggs.pmg.net/spe/functions/cms add reaction',
        POST_COMMENT: 'https://ggs.pmg.net/spe/functions/CMS Post Comment',
        POPULAR_POSTS: 'https://ggs.pmg.net/spe/functions/CMS Get Popular Posts'
    },
    PILLARS: {
        "W": { class: "pillar-whats-new", name: "What's New & Improved" },
        "S": { class: "pillar-stories", name: "Stories & Spotlights" },
        "L": { class: "pillar-learning", name: "Learning & Growth" },
        "T": { class: "pillar-tips", name: "Tips & Tricks" }
    },
    PLACEHOLDER_IMG: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Placeholder_view_vector.svg/1280px-Placeholder_view_vector.svg.png',
    AVATAR_DEFAULT: 'https://upload.wikimedia.org/wikipedia/commons/9/99/Sample_User_Icon.png'
};

/* ==========================================================================
   UTILS
   ========================================================================== */
   
const UTILS = {
    getMimeType(base64) {
        if (!base64) return 'image/png';
        const signatures = { '/': 'image/jpeg', 'i': 'image/png', 'R': 'image/gif', 'U': 'image/webp' };
        return signatures[base64.charAt(0)] || 'image/png';
    },

    toBase64Url(base64) {
        if (!base64) return CONFIG.PLACEHOLDER_IMG;
        return `data:${this.getMimeType(base64)};base64,${base64}`;
    },

    getRelativeTime(dateString) {
        const date = new Date(dateString + 'Z');
        const diffInSeconds = Math.round((date - new Date()) / 1000);
        const rtf = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });
        const units = [
            { unit: 'year', s: 31536000 }, { unit: 'month', s: 2592000 },
            { unit: 'day', s: 86400 }, { unit: 'hour', s: 3600 },
            { unit: 'minute', s: 60 }, { unit: 'second', s: 1 }
        ];
        for (const { unit, s } of units) {
            if (Math.abs(diffInSeconds) >= s || unit === 'second') {
                return rtf.format(Math.round(diffInSeconds / s), unit);
            }
        }
    }
};

/* ==========================================================================
   APP STATE
   ========================================================================== */
const APP_STATE = {
    allPosts: [],
    
    filters : {
        activePillar: 'A',
        activeSearch: '',
        displayLimit: 5,
        pageSize: 5
    },
    
    currentPostId: null,
    currentPage: 1,
    isLoading: false,
    
    getFilteredPosts() {
    const query = (this.filters.activeSearch || "").toLowerCase();
    const activePillar = this.filters.activePillar;

    return this.allPosts
        .filter(post => {
            const matchesPillar = activePillar === 'A' || post.pillar === activePillar;
            const title = (post.title || "").toLowerCase();
            const headline = (post.headline || "").toLowerCase();
            const matchesSearch = title.includes(query) || headline.includes(query);
            return matchesPillar && matchesSearch;
        })
        .sort( (a, b)=> new Date(b.published_at + 'Z') - new Date(a.published_at + 'Z'))
        .slice(0, this.filters.displayLimit);
    } ,
    updatePostInState(postId, newData) {
        const index = this.allPosts.findIndex(p => String(p.post_id) === String(postId));
        if (index !== -1) {
            this.allPosts[index] = { ...this.allPosts[index], ...newData };
            return true;
        }
        return false;
    }
}
/* ==========================================================================
   API SERVICE
   ========================================================================== */
const API_SERVICE = {
    async request(url, body) {
        try {
            const resp = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });
            if (!resp.ok) throw new Error(`HTTP Error: ${resp.status}`);
            return await resp.json();
        } catch (error) {
            console.error(`API Error (${url}):`, error);
            throw error;
        }
    },
    async fetchPosts() { 
        const activePillar = APP_STATE.filters.activePillar;
        const activeSearch = APP_STATE.filters.activeSearch;
        const displayLimit = APP_STATE.filters.displayLimit;
        const pageSize = APP_STATE.filters.pageSize;
        let filtered = APP_STATE.getFilteredPosts();
    
        if (filtered.length < APP_STATE.filters.displayLimit) {
            const data = await this.request(CONFIG.API.FILTER_POSTS, { 
            pillar: activePillar, 
            status: "U",
            query: activeSearch,
            page_number: Math.ceil(displayLimit / 5),
            page_size: pageSize
            });
            data.forEach(post => {
            if (!APP_STATE.allPosts.find(p => p.post_id === post.post_id)) {
                APP_STATE.allPosts.push(post);
            }
            });
            filtered = APP_STATE.getFilteredPosts();
        }
        return filtered;
        
    },
    fetchArticle(postId) { return this.request(CONFIG.API.GET_POST, { post_id: postId }); },
    fetchComments(postId, parentId = null) { return this.request(CONFIG.API.GET_COMMENTS, { postId, parentCommentId: parentId }); },
    postComment(postId, parentId, content) { return this.request(CONFIG.API.POST_COMMENT, { post_id: postId, parent_comment_id: parentId, content }); },
    addReaction(postId, type) { return this.request(CONFIG.API.ADD_REACTION, { post_id: postId, reaction_type: type }); },
    fetchPopularPosts() {return this.request(CONFIG.API.POPULAR_POSTS, {});}
}
/* ==========================================================================
   UI COMPONENTS
   ========================================================================== */
const UI = {
    createPostCard(post) {
        const pillarInfo = CONFIG.PILLARS[post.pillar] || {class: "", name: "Unknown"};
        const card = document.createElement('div');
        card.className = "col-md-6 col-xl-4 mb-4";
        
        card.innerHTML = `
    <div class="card announce-card h-100" data-post-id="${post.post_id}">
        <div class="card-img-wrap"><span class="pillar-tag ${pillarInfo.class}" data-pillar="${post.pillar}">${pillarInfo.name}</span><img
                src="${UTILS.toBase64Url(post.thumbnail)}"
                alt="${post.title}"></div>
        <div class="card-body d-flex flex-column">
            <h5 class="card-title mb-2">${post.title}</h5>
            <p class="card-text text-muted small mb-3 flex-grow-1">${post.headline}</p>
            <div class="d-flex align-items-center justify-content-between pt-3 border-top">
                <div class="d-flex align-items-center text-muted"><span class="reaction-chips"><span
                            class="reaction-chip bg-like" title="Like"><svg viewBox="0 0 24 24">
                                <path fill="currentColor"
                                    d="M23,10C23,8.89 22.1,8 21,8H14.68L15.64,3.43C15.66,3.33 15.67,3.22 15.67,3.11C15.67,2.7 15.5,2.32 15.23,2.05L14.17,1L7.59,7.58C7.22,7.95 7,8.45 7,9V19A2,2 0 0,0 9,21H18C18.83,21 19.54,20.5 19.84,19.78L22.86,12.73C22.95,12.5 23,12.26 23,12V10M1,21H5V9H1V21Z">
                                </path>
                            </svg></span><span class="reaction-chip bg-love" title="Love"><svg viewBox="0 0 24 24">
                                <path fill="currentColor"
                                    d="M12.1,18.55L12,18.65L11.89,18.55C7.14,14.24 4,11.39 4,8.5C4,6.5 5.5,5 7.5,5C9.04,5 10.54,6 11.07,7.36H12.93C13.46,6 14.96,5 16.5,5C18.5,5 20,6.5 20,8.5C20,11.39 16.86,14.24 12.1,18.55Z">
                                </path>
                            </svg></span><span class="reaction-chip bg-celebrate" title="Celebrate"><svg
                                viewBox="0 0 24 24">
                                <path fill="currentColor"
                                    d="M20.2,2H19.5H18C17.1,2 16,3 16,4H8C8,3 6.9,2 6,2H4.5H3.8H2V11C2,12 3,13 4,13H6.2C6.6,15 7.9,16.7 11,17V19.1C8.8,19.3 8,20.4 8,21.7V22H16V21.7C16,20.4 15.2,19.3 13,19.1V17C16.1,16.7 17.4,15 17.8,13H20C21,13 22,12 22,11V2H20.2M4,11V4H6V6V11C5.1,11 4,11 4,11M20,11C20,11 18.9,11 18,11V6V4H20V11Z">
                                </path>
                            </svg></span></span><small class="me-3 fw-bold reactions-count" data-count="total">${post.reactions || 0}</small><svg
                        class="icon-18 me-1 engagement-comment" width="18" viewBox="0 0 24 24">
                        <path fill="currentColor"
                            d="M9,22A1,1 0 0,1 8,21V18H4A2,2 0 0,1 2,16V4C2,2.89 2.9,2 4,2H20A2,2 0 0,1 22,4V16A2,2 0 0,1 20,18H13.9L10.2,21.71C10,21.9 9.75,22 9.5,22V22H9M10,16V19.08L13.08,16H20V4H4V16H10Z">
                        </path>
                    </svg><small class="fw-bold comments-count">${post.comments || 0}</small></div><small class="text-muted">${post.published_at}</small>
            </div>
        </div>
    </div>
    `;
        
        return card;
    },
    createIdeaCard() {
        const div = document.createElement('div');
        div.className = "col-md-6 col-xl-4 mb-4";
    
        div.innerHTML = `
            <div class="card idea-card idea-card-ghost h-100">
                <div class="card-body text-center p-4 d-flex flex-column justify-content-center">
                    <div class="mb-3 d-flex justify-content-center"><svg class="idea-icon" width="40" height="40"
                            viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path
                                d="M9 21C9 21.55 9.45 22 10 22H14C14.55 22 15 21.55 15 21V20H9V21ZM12 2C8.14 2 5 5.14 5 9C5 11.38 6.19 13.47 8 14.74V17C8 17.55 8.45 18 9        18H15C15.55 18 16 17.55 16 17V14.74C17.81 13.47 19 11.38 19 9C19 5.14 15.86 2 12 2Z"
                                fill="currentColor"></path>
                        </svg></div>
                    <h5 class="mb-2">Have an Idea?</h5>
                    <p class="mb-3">Got a story, a tip, or a win to share? We're always looking for content from across the ITQ
                        R&amp;D org.</p><button type="button" class="btn btn-light align-self-center" data-bs-toggle="modal"
                        data-bs-target="#submitStoryModal">Submit a Story</button>
                </div>
            </div>
            `;
    
        return div;
    },
    createLoadMoreButton() {
        const div = document.createElement('div');
        div.className = "col-12 text-center my-4";
        div.innerHTML = `<button id="loadMoreBtn" class="btn btn-outline-primary px-5">Load More</button>`;
        return div;
    },
    createCommentNode(data) {
        const li = document.createElement('li');
        li.className = 'comment-item mb-4';
        li.dataset.commentId = data.comment_id;
        li.dataset.repliesCount = data.replies_count;
        li.innerHTML = `
            <div class="d-flex">
                <img src="${CONFIG.AVATAR_DEFAULT}" class="rounded-pill avatar-50 me-3">
                <div class="flex-grow-1">
                    <div class="comment-bubble p-3 rounded">
                        <div class="d-flex justify-content-between mb-1">
                            <strong>${data.name ?? data.user_email}</strong>
                            <small class="text-muted">${UTILS.getRelativeTime(data.submited_at)}</small>
                        </div>
                        <p class="mb-0">${data.content}</p>
                    </div>
                    <div class="comment-actions mt-2">
                        <button class="btn btn-link btn-sm text-muted p-0 me-3 action-reply">Reply</button>
                        ${li.dataset.repliesCount > 0 ? `<button class="btn btn-link btn-sm text-muted p-0 action-thread">Thread (${li.dataset.repliesCount})</button>` : ""}
                    </div>
                    <div class="reply-form mt-2 d-none">
                        <input type="text" class="form-control form-control-sm mb-2 reply-input" placeholder="Write a reply...">
                        <button class="btn btn-primary btn-sm action-submit-reply">Post Reply</button>
                    </div>
                    <ul class="list-unstyled mt-3 ms-3 ps-3 border-start replies-list d-none"></ul>
                </div>
            </div>`;
        return li;
    },
    createArticleContent(article){
        const articlePage = document.getElementById('articlePage');
        articlePage.dataset.postId = article.post_id;
        
        const thumbnail = articlePage.querySelector("[data-article-template='thumbnail']");
        const title = articlePage.querySelector("[data-article-template='title']");
        const content = articlePage.querySelector("[data-article-template='content']");
        const pillarTag = articlePage.querySelector(".pillar-tag");
        const commentsCount = document.getElementById("commentCount");
        
        if (thumbnail) {
        thumbnail.src = UTILS.toBase64Url(article.thumbnail);
        }
        if (title) title.textContent = article.title || "";
        if (content) content.innerHTML = article.content || "";
        
        const pillarConfig = CONFIG.PILLARS[article.pillar];
        if (pillarTag) {
            const allPillarClasses = Object.values(CONFIG.PILLARS).map(p => p.class);
            pillarTag.classList.remove(...allPillarClasses);
        
            if (pillarConfig) {
                pillarTag.classList.add(pillarConfig.class);
                pillarTag.textContent = pillarConfig.name;
        }
        
        const pillarAll = articlePage.querySelectorAll("[data-article-template='pillar']");
        const createdAtAll = articlePage.querySelectorAll("[data-article-template='created_at']");
        const userEmailAll = articlePage.querySelectorAll("[data-article-template='user_email']");
        
        pillarAll.forEach((el) => {el.textContent = pillarConfig.name});
        createdAtAll.forEach((el) => {el.textContent = article.published_at});
        userEmailAll.forEach((el) => {el.textContent = article.user_name});
        }
    },
    createCommentList(comments, commentList=document.getElementById("commentList")){
        const fragment = document.createDocumentFragment();
        
        comments.forEach((comment) => {
            fragment.appendChild(this.createCommentNode(comment));
        });
        
        commentList.replaceChildren(fragment);
    },
    createCommentCount(article){
        const articlePage = document.getElementById('articlePage');
        const commentCount = document.getElementById('commentCount');
        if (commentCount) commentCount.textContent = article.comments || 0;
    },
    createEngagement(article){
        const articlePage = document.getElementById('articlePage');
        
        const totalReactions = articlePage.querySelector("[data-article-template='total_reactions']");
        const LikeCount = articlePage.querySelector("[data-count='like']");
        const HeartCount = articlePage.querySelector("[data-count='heart']");
        const CongratsCount = articlePage.querySelector("[data-count='congrats']");
        
    
        if (totalReactions) totalReactions.textContent = article.total_reactions || 0;
        if (LikeCount) LikeCount.textContent = article.LikeCount || 0;
        if (HeartCount) HeartCount.textContent = article.HeartCount || 0;
        if (CongratsCount) CongratsCount.textContent = article.ClapCount || 0;
        
        const reactionButtons = articlePage.querySelectorAll(".reaction-btn");
        
        reactionButtons.forEach(btn => {
            if (btn.dataset.reaction === article.current_user_reaction) {
                btn.classList.add('active');
            }
            else {
                btn.classList.remove('active');
            }
        })
        
  
    },
    createEngagementOnGrid(postId, engagement){
        const grid = document.getElementById("cardGrid");
        const post = grid.querySelector(`[data-post-id='${postId}']`);
        
        if (post) {
            if (engagement.total_reactions){
                post.querySelector('.reactions-count').textContent = engagement.total_reactions;
            }
            if (engagement.comments){
                post.querySelector('.comments-count').textContent = engagement.comments;
            }
        }
        
    },
    
    createArticleView(article){
        this.createArticleContent(article);
        this.createEngagement(article);
        this.createCommentCount(article);
    },
    createPopularCard(popularInfo){
        const li = document.createElement('li');
        li.className = "d-flex mb-3 popular-item";
        li.dataset.postId = popularInfo.post_id;
        li.style.cursor = 'pointer';
        const pillar = CONFIG.PILLARS[popularInfo.pillar]?.name;
        
        li.innerHTML = `
            <img
                    src="${UTILS.toBase64Url(popularInfo.thumbnail)}" class="popular-thumb me-3" alt="">
            <div class="flex-grow-1">
                <div class="fw-bold mb-1 small">${popularInfo.title}</div>
                <small class="text-muted">${pillar} · ${popularInfo.total_reactions} reactions (${popularInfo.monthly_reactions} ↑)</small>
            </div>
        `;
        
        return li;
        
    },
    createPopularPostsList(popularPosts) {
        const popularList = document.getElementById("popularPostsList");
        const docFragment = document.createDocumentFragment();
        
        popularPosts.forEach(post => {
            docFragment.appendChild(this.createPopularCard(post));
        })
        
        popularList.replaceChildren(docFragment);
    },
    updateReaction(reactionType){
        const articlePage = document.getElementById("articlePage");
        const reactionButtons = articlePage.querySelectorAll(".reaction-btn");
        
        reactionButtons.forEach(btn => {
            const currReaction = btn.dataset.reaction;
            if (reactionType && currReaction === reactionType){
             btn.classList.add("active");
            }
            else {
             btn.classList.remove("active");
            }
        });
    }
    
};
/* ==========================================================================
   APP CONTROLLER
   ========================================================================== */
const APP_CONTROLLER = {
    async initDashboard() {
        const grid = document.getElementById("cardGrid");
        if (!grid) return;
        
        try {
            APP_STATE.isLoading = true;
            const posts = await API_SERVICE.fetchPosts();
            
            this.renderGrid(posts);
        } catch (error) {
            console.error("Dashboard init error:", error);
        } finally {
            APP_STATE.isLoading = false;
        }
    },
    renderGrid(posts) {
        const grid = document.getElementById("cardGrid");
        grid.replaceChildren();
        
        if (posts.length === 0) {
            grid.innerHTML = '<div class="col-8 text-center p-5"><h5>No articles found matching your criteria.</h5></div>';
        } else {
            posts.forEach(post => grid.appendChild(UI.createPostCard(post)));
        }
        
        grid.appendChild(UI.createIdeaCard());
        
        if (posts.length >= APP_STATE.filters.displayLimit) {
            grid.appendChild(UI.createLoadMoreButton());
        }
    },
    async handleFilter(pillar) {
        APP_STATE.filters.activePillar = pillar;
        const filtered = await API_SERVICE.fetchPosts();
        this.renderGrid(filtered);
    },
    async handleSearch(query) {
        APP_STATE.filters.activeSearch = query;
        const filtered = await API_SERVICE.fetchPosts();
        this.renderGrid(filtered);
    },
    async handleReaction(postId, reactionType){
        const post = APP_STATE.allPosts.find(p => String(p.post_id) === String(postId));
        const previousReaction = post ? post.current_user_reaction : null;
        
        const newReaction = (previousReaction === reactionType) ? null : reactionType;
        
        UI.updateReaction(reactionType);
        
        try {
            const reactionsCount = await API_SERVICE.addReaction(postId, reactionType);
            
            const viewData = {
                ...reactionsCount,
                current_user_reaction: newReaction
            };
            
            APP_STATE.updatePostInState(postId, viewData)
            UI.createEngagement(viewData);
            UI.createEngagementOnGrid(postId, reactionsCount);
        } catch (error) {
            console.error(error);
            UI.updateReaction(reactionType);
        }
    },
    async postNewComment(postId, parentId, content) {
        if (!content?.trim()) return;
        
        try {
            const newCommentData = await API_SERVICE.postComment(postId, parentId, content);
            
            const newComments = await API_SERVICE.fetchComments(postId);
            
            const actualCount = newCommentData.comments_count; 
            APP_STATE.updatePostInState(postId, { comments: actualCount });
            
            UI.createCommentList(newComments);
            UI.createCommentCount({ comments: actualCount });
            UI.createEngagementOnGrid(postId, { comments: actualCount });
            return true;
        } catch (error) {
            console.error("Failed to post comment:", error);
            throw error;
        }
    },
    async loadThread(postId, parentId, container) {
        if (container.dataset.loaded === "true") return;

        try {
            container.innerHTML = '<li class="small text-muted p-2">Loading replies...</li>';
            
            const replies = await API_SERVICE.fetchComments(postId, parentId);
            
            if (replies && replies.length > 0) {
                UI.createCommentList(replies, container);
                container.dataset.loaded = "true";
            } else {
                container.innerHTML = '<li class="small text-muted p-2">No replies found.</li>';
            }
        } catch (error) {
            container.innerHTML = '<li class="small text-danger p-2">Error loading replies.</li>';
        }
    },
    async openArticle(postId) {
        document.body.style.cursor = 'wait';
        try {
            const articleData = await API_SERVICE.fetchArticle(postId);
            const article = JSON.parse(articleData.query_result);
            const comments = await API_SERVICE.fetchComments(postId, null);
            const popularPosts = await API_SERVICE.fetchPopularPosts();
            
            document.getElementById("mainPage").classList.add("d-none");
            document.getElementById("articlePage").classList.remove("d-none");
            window.scrollTo({ top: 0, behavior: 'instant' });
            
            UI.createArticleView(article);
            UI.createCommentList(comments)
            UI.createPopularPostsList(popularPosts);
        } catch (error) {
            alert(`Could not load the article. ${error}`);
        } finally {
            document.body.style.cursor = 'default';
        }
    },
    async handleLoadMore() {
    if (APP_STATE.isLoading) return;
    
    APP_STATE.isLoading = true;
    const btn = document.getElementById('loadMoreBtn');
    if (btn) btn.disabled = true;

    APP_STATE.filters.displayLimit += 5;
    const posts = await API_SERVICE.fetchPosts();
    this.renderGrid(posts);
    
    APP_STATE.isLoading = false;}
}
/* ==========================================================================
   EVENT REGISTRY
   ========================================================================== */
const EVENT_REGISTRY = {
    init() {
        const grid = document.getElementById("cardGrid");
        grid?.addEventListener('click', (e) => {
            const card = e.target.closest('.announce-card');
            const loadMoreBtn = document.getElementById("loadMoreBtn")
            if (card) {
                const postId = card.dataset.postId;
                APP_CONTROLLER.openArticle(postId);
                return;
            }
            if (loadMoreBtn) {
                APP_CONTROLLER.handleLoadMore();
            }
        });

        const filterContainer = document.getElementById('filterPills');
        filterContainer?.addEventListener('click', (e) => {
            
            const btn = e.target.closest('.pill');
            if (btn) {
                filterContainer.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                APP_CONTROLLER.handleFilter(btn.dataset.pillar);
            }
        });

        const searchInput = document.getElementById('searchInput');
        searchInput?.addEventListener('input', (e) => {
            APP_CONTROLLER.handleSearch(e.target.value.trim());
        });

        document.getElementById('backToLanding').addEventListener('click', () => {
                document.getElementById("mainPage").classList.remove("d-none");
                document.getElementById("articlePage").classList.add("d-none");
        });
        
        document.getElementById("articlePage").addEventListener('click', (e) => {
            const btn = e.target.closest(".reaction-btn");
        
            if (btn) {
                const currentPostId = articlePage.dataset.postId; 
                const reaction = btn.dataset.reaction;
                
                APP_CONTROLLER.handleReaction(currentPostId, reaction);
            } 
        });
        
        document.getElementById("commentList").addEventListener('click', async (e) => {
            const replyBtn = e.target.closest(".action-reply");
            const submitBtn = e.target.closest(".action-submit-reply");
            const threadBtn = e.target.closest(".action-thread");
        
            if (replyBtn) {
                const commentLi = replyBtn.closest('li');
                commentLi?.querySelector('.reply-form')?.classList.toggle('d-none');
                return;
            }
            
            if (threadBtn) {
                const commentLi = threadBtn.closest('li');
                const repliesContainer = commentLi.querySelector('.replies-list');
                const postId = document.getElementById('articlePage').dataset.postId;
                const parentId = commentLi.dataset.commentId;
                
                repliesContainer.classList.toggle('d-none');
                if (!repliesContainer.classList.contains('d-none')) {
                    await APP_CONTROLLER.loadThread(postId, parentId, repliesContainer);
                    
                    threadBtn.textContent = "Hide replies";
                } else {
                    threadBtn.textContent = `Thread (${commentLi.dataset.repliesCount || '...'})`;
                }
                return;
            }
        
            if (submitBtn) {
                const replyForm = submitBtn.closest('.reply-form');
                const inputReply = replyForm?.querySelector('.reply-input');
                const commentLi = submitBtn.closest('li');
                
                const content = inputReply?.value.trim();
                const parentId = commentLi?.dataset.commentId;
                const postId = document.getElementById('articlePage').dataset.postId;
        
                if (!content || !postId) return;
        
                submitBtn.disabled = true;
        
                try {
                    await APP_CONTROLLER.postNewComment(postId, parentId, content);
                    
                    inputReply.value = '';
                    replyForm.classList.add('d-none');
                } catch (error) {
                    alert("Failed to post reply. Please try again.");
                } finally {
                    submitBtn.disabled = false;
                }
            }
        });
        
        const submitBtn = document.getElementById('commentForm').querySelector('.btn');
        const inputField = document.getElementById('commentInput');
        
        submitBtn?.addEventListener('click', async () => {
            const content = inputField?.value.trim();
            const postId = document.getElementById('articlePage')?.dataset.postId;
            
            if (!content || !postId) return;
            
            submitBtn.disabled = true;
            try {
                await APP_CONTROLLER.postNewComment(postId, null, content);
                inputField.value = '';
            } catch(err) {
                alert("Could not post your comment. Please try again.");
            } finally {
                submitBtn.disabled = false;
            }
        });
        
        const popularList = document.getElementById('popularPostsList');
        
        popularList?.addEventListener('click', (e) => {
            const li = e.target.closest('li');
            const postId = li?.dataset?.postId;
            
            if (postId){
                APP_CONTROLLER.openArticle(postId);
            }
        });
        
        
    }
};

document.addEventListener('DOMContentLoaded', () => {
    EVENT_REGISTRY.init();
    APP_CONTROLLER.initDashboard();
});
