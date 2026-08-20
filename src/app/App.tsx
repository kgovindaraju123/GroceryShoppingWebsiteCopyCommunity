import { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { AuthModal } from './components/AuthModal';
import { HomePage } from './components/pages/HomePage';
import { ProductsPage } from './components/pages/ProductsPage';
import { ProductDetailsPage } from './components/pages/ProductDetailsPage';
import { AboutPage } from './components/pages/AboutPage';
import { ContactPage } from './components/pages/ContactPage';
import { CartPage } from './components/pages/CartPage';
import { CheckoutPage } from './components/pages/CheckoutPage';
import { ProfilePage } from './components/pages/ProfilePage';
import { WishlistPage } from './components/pages/WishlistPage';
import {
  apiGetMe, apiRefresh,
  fetchCart, saveCart, fetchWishlist, saveWishlist,
  getStoredToken, clearTokens,
} from './lib/api';

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

interface Product {
  id: number;
  name: string;
  price: number;
  originalPrice?: number;
  category: string;
  rating: number;
  image: string;
  organic?: boolean;
  onSale?: boolean;
}

interface AuthUser {
  id: string;
  name: string;
  email: string;
}

interface WishlistItem {
  id: number;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  rating: number;
  category: string;
}

export default function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authIntent, setAuthIntent] = useState<'checkout' | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  const cartTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const wishlistTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Restore session from localStorage on mount
  useEffect(() => {
    async function restoreSession() {
      let token = getStoredToken();

      if (token) {
        let meData = await apiGetMe(token);

        // Token expired — try refreshing
        if (!meData) {
          token = await apiRefresh();
          if (token) meData = await apiGetMe(token);
        }

        if (meData?.user && token) {
          setUser(meData.user);
          setAccessToken(token);
          const [cart, wishlist] = await Promise.all([fetchCart(token), fetchWishlist(token)]);
          setCartItems(cart);
          setWishlistItems(wishlist);
        } else {
          clearTokens();
        }
      }

      setDataLoaded(true);
    }

    restoreSession();
  }, []);

  // Debounced cart sync
  useEffect(() => {
    if (!accessToken || !dataLoaded) return;
    clearTimeout(cartTimerRef.current);
    cartTimerRef.current = setTimeout(() => saveCart(accessToken, cartItems), 700);
    return () => clearTimeout(cartTimerRef.current);
  }, [cartItems, accessToken, dataLoaded]);

  // Debounced wishlist sync
  useEffect(() => {
    if (!accessToken || !dataLoaded) return;
    clearTimeout(wishlistTimerRef.current);
    wishlistTimerRef.current = setTimeout(() => saveWishlist(accessToken, wishlistItems), 700);
    return () => clearTimeout(wishlistTimerRef.current);
  }, [wishlistItems, accessToken, dataLoaded]);

  const handleAddToCart = (product: Product, quantity: number = 1) => {
    setCartItems(prevItems => {
      const existingItem = prevItems.find(item => item.id === product.id);
      if (existingItem) {
        return prevItems.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [...prevItems, { id: product.id, name: product.name, price: product.price, quantity, image: product.image }];
    });
  };

  const handleUpdateQuantity = (id: number, quantity: number) => {
    if (quantity === 0) { handleRemoveItem(id); return; }
    setCartItems(prevItems => prevItems.map(item => item.id === id ? { ...item, quantity } : item));
  };

  const handleRemoveItem = (id: number) => {
    setCartItems(prevItems => prevItems.filter(item => item.id !== id));
  };

  const handleToggleWishlist = (product: WishlistItem) => {
    setWishlistItems(prev => {
      const exists = prev.find(i => i.id === product.id);
      return exists ? prev.filter(i => i.id !== product.id) : [...prev, product];
    });
  };

  const handleAuthSuccess = async (loggedInUser: AuthUser, token: string) => {
    setUser(loggedInUser);
    setAccessToken(token);
    setShowAuthModal(false);

    const [cart, wishlist] = await Promise.all([fetchCart(token), fetchWishlist(token)]);
    setCartItems(cart);
    setWishlistItems(wishlist);
    setDataLoaded(true);

    if (authIntent === 'checkout') setCurrentPage('checkout');
    setAuthIntent(null);
  };

  const handleLogout = () => {
    clearTimeout(cartTimerRef.current);
    clearTimeout(wishlistTimerRef.current);
    clearTokens();
    setUser(null);
    setAccessToken(null);
    setCartItems([]);
    setWishlistItems([]);
    setDataLoaded(false);
    setCurrentPage('home');
  };

  const handleNavigate = (page: string) => {
    setCurrentPage(page);
    setSelectedProductId(null);
  };

  const handleProductClick = (productId: number) => {
    setSelectedProductId(productId);
    setCurrentPage('product-details');
  };

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const wishlistCount = wishlistItems.length;

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'home':
        return (
          <HomePage
            onNavigate={handleNavigate}
            onAddToCart={handleAddToCart}
            onUpdateQuantity={handleUpdateQuantity}
            onProductClick={handleProductClick}
            onToggleWishlist={handleToggleWishlist}
            cartItems={cartItems}
            wishlistItems={wishlistItems}
          />
        );
      case 'shop':
        return (
          <ProductsPage
            onAddToCart={handleAddToCart}
            onUpdateQuantity={handleUpdateQuantity}
            onProductClick={handleProductClick}
            onToggleWishlist={handleToggleWishlist}
            cartItems={cartItems}
            wishlistItems={wishlistItems}
          />
        );
      case 'product-details':
        return selectedProductId ? (
          <ProductDetailsPage
            productId={selectedProductId}
            onAddToCart={handleAddToCart}
            onProductClick={handleProductClick}
            onNavigate={handleNavigate}
            onToggleWishlist={handleToggleWishlist}
            wishlistItems={wishlistItems}
          />
        ) : (
          <HomePage
            onNavigate={handleNavigate}
            onAddToCart={handleAddToCart}
            onUpdateQuantity={handleUpdateQuantity}
            onProductClick={handleProductClick}
            onToggleWishlist={handleToggleWishlist}
            cartItems={cartItems}
            wishlistItems={wishlistItems}
          />
        );
      case 'about':
        return <AboutPage />;
      case 'contact':
        return <ContactPage />;
      case 'cart':
        return (
          <CartPage
            cartItems={cartItems}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onNavigate={handleNavigate}
            user={user}
            onRequireAuth={() => { setAuthIntent('checkout'); setShowAuthModal(true); }}
          />
        );
      case 'checkout':
        return <CheckoutPage cartItems={cartItems} onNavigate={handleNavigate} user={user} />;
      case 'wishlist':
        return (
          <WishlistPage
            wishlistItems={wishlistItems}
            cartItems={cartItems}
            onToggleWishlist={handleToggleWishlist}
            onAddToCart={handleAddToCart}
            onUpdateQuantity={handleUpdateQuantity}
            onProductClick={handleProductClick}
            onNavigate={handleNavigate}
          />
        );
      case 'profile':
        return user ? (
          <ProfilePage user={user} onLogout={handleLogout} onNavigate={handleNavigate} />
        ) : (
          <HomePage
            onNavigate={handleNavigate}
            onAddToCart={handleAddToCart}
            onUpdateQuantity={handleUpdateQuantity}
            onProductClick={handleProductClick}
            onToggleWishlist={handleToggleWishlist}
            cartItems={cartItems}
            wishlistItems={wishlistItems}
          />
        );
      default:
        return (
          <HomePage
            onNavigate={handleNavigate}
            onAddToCart={handleAddToCart}
            onUpdateQuantity={handleUpdateQuantity}
            onProductClick={handleProductClick}
            onToggleWishlist={handleToggleWishlist}
            cartItems={cartItems}
            wishlistItems={wishlistItems}
          />
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header
        currentPage={currentPage}
        onNavigate={handleNavigate}
        cartCount={cartCount}
        wishlistCount={wishlistCount}
        user={user}
        onOpenAuth={() => setShowAuthModal(true)}
      />

      <main className="flex-1">
        {renderCurrentPage()}
      </main>

      <Footer onNavigate={handleNavigate} />

      {showAuthModal && (
        <AuthModal
          onClose={() => { setShowAuthModal(false); setAuthIntent(null); }}
          onAuthSuccess={handleAuthSuccess}
        />
      )}
    </div>
  );
}
