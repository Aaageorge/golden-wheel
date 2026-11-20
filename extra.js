        // Swipe gestures were removed: a quick vertical flick was treated as a
        // swipe and scrolled the page back to the top, and a horizontal flick
        // navigated back/forward. Browsers already provide both natively.

        // Follow System Functions
        async function followUser(targetUserId) {
            if (!currentUser || !db || currentUser.uid === targetUserId) return;
            
            try {
                // Add to following list
                await set(ref(db, `following/${currentUser.uid}/${targetUserId}`), {
                    followedAt: Date.now(),
                    targetUserId: targetUserId
                });
                
                // Add to followers list of target user
                await set(ref(db, `followers/${targetUserId}/${currentUser.uid}`), {
                    followedAt: Date.now(),
                    followerId: currentUser.uid
                });
                
                // Update UI
                updateFollowButton(targetUserId, true);
                loadFollowStats();
                showNotification('You are now following this user!');
            } catch (error) {
                console.error('Follow failed:', error);
                showNotification('Failed to follow user', 'error');
            }
        }

        async function unfollowUser(targetUserId) {
            if (!currentUser || !db) return;
            
            try {
                // Remove from following list
                await remove(ref(db, `following/${currentUser.uid}/${targetUserId}`));
                
                // Remove from followers list of target user
                await remove(ref(db, `followers/${targetUserId}/${currentUser.uid}`));
                
                // Update UI
                updateFollowButton(targetUserId, false);
                loadFollowStats();
                showNotification('You have unfollowed this user');
            } catch (error) {
                console.error('Unfollow failed:', error);
                showNotification('Failed to unfollow user', 'error');
            }
        }

        async function isFollowing(targetUserId) {
            if (!currentUser || !db) return false;
            
            try {
                const followRef = ref(db, `following/${currentUser.uid}/${targetUserId}`);
                const snapshot = await get(followRef);
                return snapshot.exists();
            } catch (error) {
                console.error('Check follow status failed:', error);
                return false;
            }
        }

        async function loadFollowStats() {
            if (!currentUser || !db) return;
            
            try {
                // Load followers count
                const followersRef = ref(db, `followers/${currentUser.uid}`);
                const followersSnapshot = await get(followersRef);
                const followersCount = followersSnapshot.exists() ? Object.keys(followersSnapshot.val()).length : 0;
                
                // Load following count
                const followingRef = ref(db, `following/${currentUser.uid}`);
                const followingSnapshot = await get(followingRef);
                const followingCount = followingSnapshot.exists() ? Object.keys(followingSnapshot.val()).length : 0;
                
                // Update UI with element existence checks
                const followersCountEl = document.getElementById('profileFollowersCount');
                const followingCountEl = document.getElementById('profileFollowingCount');
                
                if (followersCountEl) followersCountEl.textContent = followersCount;
                if (followingCountEl) followingCountEl.textContent = followingCount;
                
            } catch (error) {
                console.error('Load follow stats failed:', error);
                throw error; // Re-throw to be caught by caller
            }
        }

        async function loadFollowers() {
            if (!currentUser || !db) return;
            
            try {
                const followersRef = ref(db, `followers/${currentUser.uid}`);
                const followersSnapshot = await get(followersRef);
                const followersData = followersSnapshot.val() || {};
                
                const followersGrid = document.getElementById('profileFollowersGrid');
                if (!followersGrid) {
                    console.error('profileFollowersGrid element not found');
                    return;
                }
                
                if (Object.keys(followersData).length === 0) {
                    followersGrid.innerHTML = '<p style="text-align: center; color: #888; grid-column: 1/-1;">No followers yet</p>';
                    return;
                }
                
                // Load user details for each follower
                const followerPromises = Object.keys(followersData).map(async (followerId) => {
                    const userRef = ref(db, `users/${followerId}`);
                    const userSnapshot = await get(userRef);
                    const userData = userSnapshot.val();
                    return { uid: followerId, ...userData };
                });
                
                const followers = await Promise.all(followerPromises);
                
                followersGrid.innerHTML = followers.map(follower => `
                    <div class="profile-user-card">
                        <div class="profile-user-avatar">
                            ${follower.name ? follower.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div class="profile-user-info">
                            <div class="profile-user-name">${follower.name || 'Unknown User'}</div>
                            <div class="profile-user-email">${follower.email || ''}</div>
                        </div>
                        ${currentUser.uid !== follower.uid ? `
                            <button class="follow-btn" onclick="toggleFollow('${follower.uid}', this)">
                                Following
                            </button>
                        ` : ''}
                    </div>
                `).join('');
                
            } catch (error) {
                console.error('Load followers failed:', error);
                throw error; // Re-throw to be caught by caller
            }
        }

        async function loadFollowing() {
            if (!currentUser || !db) return;
            
            try {
                const followingRef = ref(db, `following/${currentUser.uid}`);
                const followingSnapshot = await get(followingRef);
                const followingData = followingSnapshot.val() || {};
                
                const followingGrid = document.getElementById('profileFollowingGrid');
                if (!followingGrid) {
                    console.error('profileFollowingGrid element not found');
                    return;
                }
                
                if (Object.keys(followingData).length === 0) {
                    followingGrid.innerHTML = '<p style="text-align: center; color: #888; grid-column: 1/-1;">Not following anyone yet</p>';
                    return;
                }
                
                // Load user details for each following
                const followingPromises = Object.keys(followingData).map(async (followingId) => {
                    const userRef = ref(db, `users/${followingId}`);
                    const userSnapshot = await get(userRef);
                    const userData = userSnapshot.val();
                    return { uid: followingId, ...userData };
                });
                
                const followingUsers = await Promise.all(followingPromises);
                
                followingGrid.innerHTML = followingUsers.map(user => `
                    <div class="profile-user-card">
                        <div class="profile-user-avatar">
                            ${user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div class="profile-user-info">
                            <div class="profile-user-name">${user.name || 'Unknown User'}</div>
                            <div class="profile-user-email">${user.email || ''}</div>
                        </div>
                        <button class="follow-btn following" onclick="toggleFollow('${user.uid}', this)">
                            Following
                        </button>
                    </div>
                `).join('');
                
            } catch (error) {
                console.error('Load following failed:', error);
                throw error; // Re-throw to be caught by caller
            }
        }

        async function loadFollowFeed() {
            if (!currentUser || !db) return;
            
            try {
                const followingRef = ref(db, `following/${currentUser.uid}`);
                const followingSnapshot = await get(followingRef);
                const followingData = followingSnapshot.val() || {};
                
                const followFeedGrid = document.getElementById('profileFollowFeed');
                if (!followFeedGrid) {
                    console.error('profileFollowFeed element not found');
                    return;
                }
                
                const followingIds = Object.keys(followingData);
                if (followingIds.length === 0) {
                    followFeedGrid.innerHTML = '<p style="text-align: center; color: #888; grid-column: 1/-1;">Follow users to see their posts here</p>';
                    return;
                }
                
                // Load cars from followed users
                const carsRef = ref(db, 'cars');
                const carsSnapshot = await get(carsRef);
                const allCars = carsSnapshot.val() || {};
                
                // Filter cars by followed users and sort by date
                const followFeedCars = Object.entries(allCars)
                    .filter(([carId, car]) => followingIds.includes(car.ownerUid))
                    .map(([carId, car]) => ({ id: carId, ...car }))
                    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
                    .slice(0, 12); // Limit to 12 most recent posts
                
                if (followFeedCars.length === 0) {
                    followFeedGrid.innerHTML = '<p style="text-align: center; color: #888; grid-column: 1/-1;">No posts from followed users yet</p>';
                    return;
                }
                
                // Render cars using existing car card function
                followFeedGrid.innerHTML = followFeedCars.map(car => createCarCard(car)).join('');
                
            } catch (error) {
                console.error('Load follow feed failed:', error);
                throw error; // Re-throw to be caught by caller
            }
        }

        async function toggleFollow(targetUserId, buttonElement) {
            if (!currentUser) {
                openSignIn();
                return;
            }
            
            try {
                const isCurrentlyFollowing = await isFollowing(targetUserId);
                
                if (isCurrentlyFollowing) {
                    await unfollowUser(targetUserId);
                    if (buttonElement) {
                        buttonElement.classList.remove('following');
                        buttonElement.textContent = 'Follow';
                    }
                } else {
                    await followUser(targetUserId);
                    if (buttonElement) {
                        buttonElement.classList.add('following');
                        buttonElement.textContent = 'Following';
                    }
                }
            } catch (error) {
                console.error('Toggle follow failed:', error);
                if (buttonElement) {
                    buttonElement.textContent = 'Error';
                    setTimeout(() => {
                        buttonElement.textContent = isCurrentlyFollowing ? 'Following' : 'Follow';
                    }, 2000);
                }
            }
        }

        function updateFollowButton(targetUserId, isFollowing) {
            // Update any follow buttons for this user
            const buttons = document.querySelectorAll(`[onclick*="toggleFollow('${targetUserId}'"]`);
            buttons.forEach(button => {
                if (isFollowing) {
                    button.classList.add('following');
                    button.textContent = 'Following';
                } else {
                    button.classList.remove('following');
                    button.textContent = 'Follow';
                }
            });
        }

        function showNotification(message, type = 'success') {
            // Create notification element
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${type === 'success' ? '#2ecc71' : '#e74c3c'};
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                z-index: 10000;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                font-weight: 500;
                max-width: 300px;
                word-wrap: break-word;
            `;
            notification.textContent = message;
            
            document.body.appendChild(notification);
            
            // Auto remove after 3 seconds
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 3000);
        }

        // Helper function to create car cards for follow feed
        function createCarCard(car) {
            const isSold = (car && car.isSold === true);
            
            // Ensure images is always an array
            let cardImages;
            if (Array.isArray(car.images)) {
                cardImages = car.images;
            } else if (car.images) {
                cardImages = [car.images];
            } else {
                cardImages = [];
            }
            
            return `
                <div class="car-card ${isSold ? 'sold-listing' : ''}" onclick="viewCar('${car.id}')">
                    ${isSold ? `<div class="sold-badge">SOLD</div>` : ''}
                    <div class="card-image-container">
                        <img src="${cardImages[0] || ''}" alt="${car.name}">
                    </div>
                    <h3>${car.name}</h3>
                    <div class="price-tag">$${Number(car.price).toLocaleString()}</div>
                    <button class="BUY" ${isSold ? 'disabled' : ''} onclick="event.stopPropagation(); ${isSold ? '' : `window.open('https://wa.me/${car.phone}?text=Hello, I am interested in your ${car.name}', '_blank')}`}">${isSold ? 'Sold' : 'WhatsApp Seller'}</button>
                </div>
            `;
        }

        // Test function to verify follow system is working
        function testFollowSystem() {
            console.log('🧪 Testing Follow System...');
            console.log('✅ Follow functions available:', {
                followUser: typeof followUser,
                unfollowUser: typeof unfollowUser,
                isFollowing: typeof isFollowing,
                loadFollowStats: typeof loadFollowStats,
                loadFollowers: typeof loadFollowers,
                loadFollowing: typeof loadFollowing,
                loadFollowFeed: typeof loadFollowFeed,
                toggleFollow: typeof toggleFollow
            });
            console.log('✅ Profile elements found:', {
                profileFollowersCount: !!document.getElementById('profileFollowersCount'),
                profileFollowingCount: !!document.getElementById('profileFollowingCount'),
                profileFollowersGrid: !!document.getElementById('profileFollowersGrid'),
                profileFollowingGrid: !!document.getElementById('profileFollowingGrid'),
                profileFollowFeed: !!document.getElementById('profileFollowFeed')
            });
            console.log('🎉 Follow system test completed!');
        }

        // Test follow system - call this from console to debug
        function testFollowSystem() {
            console.log('=== Follow System Debug ===');
            console.log('Current user:', currentUser ? currentUser.uid : 'Not logged in');
            console.log('Database connected:', !!db);
            console.log('Cars data count:', Object.keys(carsData || {}).length);
            
            const followButtons = document.querySelectorAll('.follow-btn');
            console.log('Follow buttons found:', followButtons.length);
            
            // Check cars with missing ownerUid
            const carsWithoutOwner = Object.entries(carsData || {}).filter(([key, car]) => !car.ownerUid);
            console.log('Cars without ownerUid:', carsWithoutOwner.length);
            
            if (carsWithoutOwner.length > 0) {
                console.log('Sample cars without ownerUid:', carsWithoutOwner.slice(0, 3));
            }
            
            // Check follow button states
            followButtons.forEach((btn, index) => {
                console.log(`Button ${index}:`, {
                    id: btn.id,
                    text: btn.textContent,
                    classes: btn.className,
                    onclick: btn.getAttribute('onclick')
                });
            });
        }

        // Update all follow buttons on the page
        async function updateAllFollowButtons() {
            if (!currentUser) {
                console.log('No current user, skipping follow button update');
                return;
            }
            
            console.log('Updating follow buttons...');
            
            // Update follow buttons on car cards
            const followButtons = document.querySelectorAll('.follow-btn[id^="follow-btn-"]');
            console.log(`Found ${followButtons.length} follow buttons to update`);
            
            for (const button of followButtons) {
                const carId = button.id.replace('follow-btn-', '');
                const car = carsData[carId];
                const ownerIdentifier = car.ownerUid || car.ownerId;
                if (car && ownerIdentifier && ownerIdentifier !== currentUser.uid) {
                    try {
                        const isFollowingUser = await isFollowing(ownerIdentifier);
                        if (isFollowingUser) {
                            button.classList.add('following');
                            button.textContent = 'Following';
                        } else {
                            button.classList.remove('following');
                            button.textContent = 'Follow Owner';
                        }
                    } catch (error) {
                        console.error('Error updating follow button for car', carId, ':', error);
                    }
                } else {
                    console.log(`Skipping button ${button.id} - no owner identifier or user is owner`);
                }
            }
            
            console.log('Follow buttons update completed');
        }
