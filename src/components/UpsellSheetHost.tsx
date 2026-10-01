import React, { useEffect, useState } from 'react';
import UpsellSheet from './UpsellSheet';
import { useUpsellStore } from '../store/upsellStore';
import { useCartStore } from '../store/cartStore';
import { navigationRef } from '../navigation/navigationRef';
import { getUpsellSuggestions, UpsellSuggestion } from '../services/upsellService';

// Kök seviyede tek panel. open(productId) gelince önerileri çeker; boşsa
// hiç açılmaz (müşteri bir şey fark etmez), doluysa alttan panel.
export default function UpsellSheetHost() {
  const productId = useUpsellStore((s) => s.productId);
  const close = useUpsellStore((s) => s.close);
  const [suggestions, setSuggestions] = useState<UpsellSuggestion[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!productId) {
      setVisible(false);
      return;
    }
    let alive = true;
    const cartIds = useCartStore.getState().items.map((i) => i.id);
    const ids = [...new Set([productId, ...cartIds])];
    getUpsellSuggestions(ids, 4)
      .then((rows) => {
        if (!alive) return;
        if (rows.length === 0) {
          close();
          return;
        }
        setSuggestions(rows);
        setVisible(true);
      })
      .catch((e) => {
        console.warn('[upsell] öneriler alınamadı', e?.message ?? e);
        if (alive) close();
      });
    return () => {
      alive = false;
    };
  }, [productId, close]);

  const goToCart = () => {
    close();
    // Sekme adı CartTab (MainTabParamList); OrderConfirmation'daki HomeTab ile aynı desen.
    if (navigationRef.isReady()) {
      navigationRef.navigate('Main', { screen: 'CartTab' });
    }
  };

  return <UpsellSheet visible={visible} suggestions={suggestions} onClose={close} onGoToCart={goToCart} />;
}
