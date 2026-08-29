import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { SiteSettings } from '../types';
import { fetchSiteSettings } from '../services/api';

export interface SiteBrandingContextType {
  siteSettings: SiteSettings;
  isLoading: boolean;
  refreshSiteSettings: () => Promise<void>;
}

const defaultSettings: SiteSettings = {
  siteTitle: 'GAINPOWER',
  logoUrl: '',
  faviconUrl: '',
};

const SiteBrandingContext = createContext<SiteBrandingContextType>({
  siteSettings: defaultSettings,
  isLoading: true,
  refreshSiteSettings: async () => {},
});

export const SiteBrandingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshSiteSettings = useCallback(async () => {
    try {
      const data = await fetchSiteSettings();
      if (data) {
        setSiteSettings(data);
        // Apply site title to browser
        if (data.siteTitle) {
          document.title = `${data.siteTitle} — Renewable Energy Yields`;
          const metaOg = document.querySelector('meta[property="og:title"]');
          if (metaOg) {
            metaOg.setAttribute('content', data.siteTitle);
          }
        }
        // Apply favicon if configured
        if (data.faviconUrl) {
          let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.getElementsByTagName('head')[0].appendChild(link);
          }
          link.href = data.faviconUrl;
        }
      }
    } catch (err) {
      console.warn('[SITE BRANDING] Error loading settings:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSiteSettings();
  }, [refreshSiteSettings]);

  return (
    <SiteBrandingContext.Provider value={{ siteSettings, isLoading, refreshSiteSettings }}>
      {children}
    </SiteBrandingContext.Provider>
  );
};

export const useSiteBranding = () => useContext(SiteBrandingContext);
