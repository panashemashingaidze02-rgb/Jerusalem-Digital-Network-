import React, { forwardRef } from 'react';
import { Member, UserProfile } from '../types';
import { resolveBranchName } from '../lib/storage';
import { QRCodeSVG } from 'qrcode.react';

export interface IDConfig {
  logoUrl: string;
  frontBgUrl: string;
  backBgUrl: string;
  signatureUrl: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  textColor: string;
  globalExpiry: string;
  layoutStyle: 'modern' | 'classic' | 'minimalist';
  orgName: string;
  globalBasa: string;
}

interface IDCardTemplateProps {
  leader: Member | null;
  config: IDConfig;
  profiles: UserProfile[];
  className?: string;
}

export const IDCardTemplate = forwardRef<HTMLDivElement, IDCardTemplateProps>(({ leader, config, profiles, className }, ref) => {
  if (!leader) return null;

  // Scale 1:1 for CR80 assuming 300dpi is ~1012x638. We'll use mm but CSS uses pixels.
  // Standard CR80: 86mm x 54mm. In CSS px (96dpi): ~325px x 204px.
  // We'll scale it up 2x for better crispness: 650x408.
  
  const expiry = leader.idExpiryDate || config.globalExpiry;
  const branchName = resolveBranchName(leader.tabheraCode, profiles);
  const verifyUrl = `${window.location.origin}/verify/${leader.memberNumber || leader.memberId}`;

  const isClassic = config.layoutStyle === 'classic';
  const isMinimal = config.layoutStyle === 'minimalist';
  const cardWidth = isClassic ? '408px' : '650px';
  const cardHeight = isClassic ? '650px' : '408px';

  const commonStyle = {
    fontFamily: config.fontFamily || 'Inter, sans-serif',
    color: config.textColor || '#000000',
  };

  const FrontCard = () => {
    if (isClassic) return (
      <div 
        id="front-card-element"
        className="relative overflow-hidden rounded-[16px] shadow-lg flex flex-col items-center text-center front-card"
        style={{ width: cardWidth, height: cardHeight, backgroundColor: '#fff', backgroundImage: config.frontBgUrl ? `url(${config.frontBgUrl})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', border: '1px solid #e5e7eb', ...commonStyle }}
      >
        <div className="w-full pt-8 pb-32 relative flex flex-col items-center" style={{ backgroundColor: config.primaryColor }}>
          {config.logoUrl && <img src={config.logoUrl} alt="Logo" className="h-24 w-24 object-contain mx-auto mb-2 relative z-20" />}
          <h1 className="text-xl font-black tracking-wider uppercase text-white leading-tight px-4">{config.orgName || 'Makoni Church'}</h1>
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white to-transparent" />
        </div>
        
        <div className="flex-1 flex flex-col items-center z-10 w-full px-6 -mt-20">
          <div className="w-36 h-44 rounded-xl bg-gray-200 border-4 shadow-sm overflow-hidden flex items-center justify-center shrink-0 mb-4 bg-white" style={{ borderColor: config.secondaryColor || config.primaryColor }}>
            {leader.pictureUrl ? <img src={leader.pictureUrl} alt="Photo" className="w-full h-full object-cover" crossOrigin="anonymous" /> : <span className="text-gray-400 text-sm">No Photo</span>}
          </div>
          
          <h2 className="text-2xl font-black mb-1 uppercase tracking-tight w-full leading-none">{leader.fullName}</h2>
          <div className="inline-block px-4 py-1.5 rounded-full text-sm font-bold w-max mb-5 shadow-sm uppercase tracking-widest" style={{ backgroundColor: config.secondaryColor || '#e5e7eb', color: '#000' }}>
            {leader.basa || 'Mutungamiri'}
          </div>
          
          <div className="w-full grid grid-cols-5 gap-3 bg-white/60 p-3 rounded-xl backdrop-blur-sm border border-gray-100 shadow-sm text-left items-center">
            <div className="col-span-3 space-y-1.5">
              <div>
                <span className="text-[9px] tracking-widest uppercase text-gray-500 block">ID Number</span>
                <span className="font-mono text-sm font-extrabold block text-gray-800">{leader.memberNumber || leader.memberId.substring(0, 8).toUpperCase()}</span>
              </div>
              <div>
                <span className="text-[9px] tracking-widest uppercase text-gray-500 block">Valid Until</span>
                <span className="text-red-700 font-mono text-sm font-extrabold block">{expiry}</span>
              </div>
            </div>
            <div className="col-span-2 flex flex-col items-center justify-center border-l border-gray-200/50 pl-2">
              <QRCodeSVG value={verifyUrl} size={64} style={{ padding: '2px', background: '#fff', borderRadius: '4px' }} />
              <span className="text-[8px] uppercase tracking-wider font-extrabold text-gray-400 mt-1">VERIFY ID</span>
            </div>
          </div>
        </div>
        {config.signatureUrl && <img src={config.signatureUrl} alt="Signature" className="absolute bottom-4 right-4 h-12 object-contain z-20" crossOrigin="anonymous"/>}
        <div className="absolute top-0 left-0 w-full h-2" style={{ backgroundColor: config.secondaryColor }} />
        <div className="absolute bottom-0 left-0 w-full h-3" style={{ backgroundColor: config.primaryColor }} />
      </div>
    );

    if (isMinimal) return (
      <div 
        id="front-card-element"
        className="relative overflow-hidden rounded-[16px] shadow-lg flex flex-col front-card"
        style={{ width: cardWidth, height: cardHeight, backgroundColor: '#fff', backgroundImage: config.frontBgUrl ? `url(${config.frontBgUrl})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', border: '2px solid #e5e7eb', ...commonStyle }}
      >
        <div className="flex-1 flex p-10 gap-8 z-10 relative items-center bg-white/90 backdrop-blur-[1px]">
          <div className="w-36 h-48 bg-gray-100 overflow-hidden flex items-center justify-center shrink-0 border border-gray-200">
            {leader.pictureUrl ? <img src={leader.pictureUrl} alt="Photo" className="w-full h-full object-cover grayscale" crossOrigin="anonymous" /> : <span className="text-gray-300 text-sm">PHOTO</span>}
          </div>
          <div className="flex-1 flex flex-col justify-center">
            {config.logoUrl && <img src={config.logoUrl} alt="Logo" className="h-18 w-18 object-contain mb-3" />}
            <h1 className="text-sm font-bold tracking-widest uppercase mb-6 text-gray-400">{config.orgName || 'Makoni Church'}</h1>
            <h2 className="text-4xl font-black mb-2 uppercase tracking-tight leading-none text-black">{leader.fullName}</h2>
            <div className="text-lg font-bold mb-8 tracking-widest text-[#166534] uppercase">{leader.basa || 'Mutungamiri'}</div>
            
            <div className="flex justify-between items-end border-t border-gray-200 pt-4">
               <div>
                  <div className="text-[10px] uppercase text-gray-400 font-bold mb-1 tracking-widest">ID Number</div>
                  <div className="font-mono text-sm text-gray-800">{leader.memberNumber || leader.memberId.substring(0, 8).toUpperCase()}</div>
               </div>
               <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center">
                    <QRCodeSVG value={verifyUrl} size={48} style={{ padding: '2px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '2px' }} />
                    <span className="text-[7px] uppercase font-black tracking-widest text-slate-400 mt-0.5">VERIFY</span>
                  </div>
                  <div className="text-right">
                     <div className="text-[10px] uppercase text-gray-400 font-bold mb-1 tracking-widest">Expiry</div>
                     <div className="font-mono text-sm text-black font-bold">{expiry}</div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    );

    // Modern (Default)
    return (
      <div 
        id="front-card-element"
        className="relative overflow-hidden rounded-[16px] shadow-lg flex flex-col front-card"
        style={{ width: cardWidth, height: cardHeight, backgroundColor: '#fff', backgroundImage: config.frontBgUrl ? `url(${config.frontBgUrl})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', border: '1px solid #e5e7eb', ...commonStyle }}
      >
        <div className="h-24 flex items-center px-6" style={{ backgroundColor: config.primaryColor }}>
           {config.logoUrl && <img src={config.logoUrl} alt="Logo" className="h-20 w-20 object-contain animate-fade-in" />}
           <div className="ml-4 text-white">
             <h1 className="text-2xl font-black tracking-wider uppercase m-0 leading-tight">{config.orgName || 'Makoni Church'}</h1>
             <p className="text-sm font-semibold tracking-widest opacity-90 m-0" style={{ color: config.secondaryColor || '#ffffff'}}>Mabasa Council</p>
           </div>
        </div>
        <div className="flex-1 flex p-6 gap-6 z-10 relative bg-white/80 backdrop-blur-[2px]">
          <div className="flex flex-col items-center shrink-0">
            <div className="w-32 h-40 rounded-xl bg-gray-200 border-4 shadow-sm overflow-hidden flex items-center justify-center shrink-0" style={{ borderColor: config.primaryColor }}>
              {leader.pictureUrl ? <img src={leader.pictureUrl} alt="Photo" className="w-full h-full object-cover" crossOrigin="anonymous" /> : <span className="text-gray-400 text-sm">No Photo</span>}
            </div>
          </div>
          <div className="flex-1 flex flex-col justify-center min-w-0">
            <h2 className="text-2xl font-black mb-1 uppercase tracking-tight truncate leading-none text-gray-800">{leader.fullName}</h2>
            <div className="inline-block px-2.5 py-1 rounded text-xs font-bold w-max mb-3 shadow-sm uppercase tracking-wider" style={{ backgroundColor: config.secondaryColor || '#e5e7eb', color: '#000' }}>
              {leader.basa || 'Mutungamiri'}
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs font-bold">
              <div><span className="text-[10px] uppercase text-gray-500 block mb-0.5" style={{ color: config.textColor }}>ID Number</span><span className="font-mono text-sm">{leader.memberNumber || leader.memberId.substring(0, 8).toUpperCase()}</span></div>
              <div><span className="text-[10px] uppercase text-gray-500 block mb-0.5" style={{ color: config.textColor }}>Branch</span><span className="truncate block" style={{maxWidth: '120px'}}>{branchName}</span></div>
              <div><span className="text-[10px] uppercase text-gray-500 block mb-0.5" style={{ color: config.textColor }}>Group</span><span className="truncate block" style={{maxWidth: '120px'}}>{leader.groupId}</span></div>
              <div><span className="text-[10px] uppercase text-gray-500 block mb-0.5" style={{ color: config.textColor }}>Valid Until</span><span className="text-red-700 font-bold">{expiry}</span></div>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center shrink-0 border-l border-gray-150 pl-4 h-40">
            <QRCodeSVG value={verifyUrl} size={84} style={{ padding: '3px', background: '#fff', borderRadius: '6px', border: `1px solid ${config.primaryColor || '#e5e7eb'}` }} />
            <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 mt-2">VERIFY ID</span>
          </div>
        </div>
        {config.signatureUrl && <img src={config.signatureUrl} alt="Signature" className="absolute bottom-6 right-8 h-10 object-contain z-20" crossOrigin="anonymous"/>}
        <div className="absolute bottom-0 left-0 w-full h-3" style={{ backgroundColor: config.primaryColor }} />
      </div>
    );
  };

  const BackCard = () => {
    if (isMinimal) return (
      <div 
        id="back-card-element"
        className="relative overflow-hidden rounded-[16px] shadow-lg flex flex-col items-center justify-center text-center p-8 back-card"
        style={{ width: cardWidth, height: cardHeight, backgroundColor: '#fff', backgroundImage: config.backBgUrl ? `url(${config.backBgUrl})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', border: '2px solid #e5e7eb', ...commonStyle }}
      >
        <div className="absolute inset-0 bg-white/90 backdrop-blur-[1px]" />
        <div className="relative z-10 flex flex-col items-center justify-center">
          <QRCodeSVG value={verifyUrl} size={150} style={{ margin: '0 auto', padding: '0', background: '#fff' }} />
          <h3 className="mt-8 font-black text-xl uppercase tracking-widest text-[#166534]">Scan to Verify</h3>
          <p className="text-xs mt-4 opacity-60 font-bold uppercase tracking-wide max-w-sm">Property of {config.orgName || 'Makoni Church'}</p>
        </div>
      </div>
    );

    return (
      <div 
        id="back-card-element"
        className="relative overflow-hidden rounded-[16px] shadow-lg flex flex-col items-center justify-center text-center p-8 back-card"
        style={{ width: cardWidth, height: cardHeight, backgroundColor: '#fff', backgroundImage: config.backBgUrl ? `url(${config.backBgUrl})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', border: '1px solid #e5e7eb', ...commonStyle }}
      >
        <div className="absolute top-0 left-0 w-full h-10" style={{ backgroundColor: config.primaryColor }} />
        <div className="bg-white/90 p-6 rounded-xl backdrop-blur-sm border shadow-sm max-w-[80%] flex flex-col items-center relative z-10 w-full">
          {isClassic && config.logoUrl && <img src={config.logoUrl} alt="Logo" className="absolute top-4 right-4 h-10 w-10 object-contain opacity-20" />}
          <QRCodeSVG value={verifyUrl} size={isClassic ? 150 : 130} style={{ margin: '0 auto', border: `3px solid ${config.primaryColor}`, padding: '4px', borderRadius: '8px', background: '#fff' }} />
          <h3 className="mt-4 font-bold text-lg">Scan to Verify</h3>
          <p className="text-sm mt-2 opacity-80 max-w-[250px]">
            This card remains the property of {config.orgName || 'Makoni Church'}. If found, please return to any branch or scan the code for contact info.
          </p>
        </div>
        <div className="absolute bottom-0 left-0 w-full h-3" style={{ backgroundColor: config.secondaryColor }} />
      </div>
    );
  };

  return (
    <div ref={ref} className={className || "flex gap-4 items-start"} style={{ position: 'relative' }}>
      <FrontCard />
      <BackCard />
    </div>
  );
});
