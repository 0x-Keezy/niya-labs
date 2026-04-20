# Design Guidelines for Amica Web Application Import

## Design Approach: Preservation of Original Design

This project imports an existing, fully-designed application. Our approach is to **preserve the original Amica design** while ensuring optimal functionality in Replit's preview environment.

## Core Design Principles

**Maintain Existing Visual Identity**
- Preserve Amica's established 3D character interface and UI layout
- Keep the original vertical sidebar navigation (Settings, Chat History, Mute, Camera, Language, Share, Import, Brain, Chat Toggle)
- Maintain existing iconography and visual hierarchy
- Respect the original responsive breakpoints and layouts

**3D Viewport Priority**
- Full viewport 3D canvas for character rendering (primary focus)
- Overlay UI elements without obstructing the 3D character
- Ensure Three.js rendering performs optimally in Replit preview
- Maintain smooth animations and character expressions

## Layout System

**Primary Structure**
- Full-screen 3D canvas background with character centered
- Left-aligned vertical icon menu (fixed position, z-index above canvas)
- Bottom-aligned chat input interface (semi-transparent overlay)
- Settings panel as slide-out drawer from left side

**Spacing Approach**
- Use Tailwind utilities: p-4, p-6, p-8 for consistent padding
- Gap utilities: gap-4, gap-6 for component spacing
- Maintain breathing room around interactive elements (min-touch target: 44px)

## Typography

**Font Stack** (from existing implementation)
- Primary: System fonts for performance
- Japanese/Multi-language support maintained via i18next
- Hierarchy: Text-sm for UI labels, text-base for content, text-lg/xl for headings

## Component Library

**Navigation Menu**
- Vertical icon stack (left side)
- Icon size: 24px with p-3 touch targets
- Tooltip labels on hover
- Active state indicator for current section

**Chat Interface**
- Bottom-positioned input bar with microphone and text input
- Send button with clear visual affordance
- Chat history display with scroll area
- Message bubbles: User (right-aligned), AI (left-aligned)

**Settings Panel**
- Slide-out drawer (320px-400px width)
- Tabbed sections: Appearance, Voice, Chat Backend, Advanced
- Form inputs with clear labels
- File upload for VRM models (drag-drop support)

**3D Character Display**
- Full viewport rendering
- Responsive to window resize
- Performance stats overlay (optional, bottom-right)
- Camera controls: Orbit, zoom, pan

## Responsive Behavior

**Desktop (1024px+)**
- Full 3D viewport with overlay UI
- Sidebar navigation visible
- Chat interface at bottom-center

**Tablet (768px-1023px)**
- Maintain 3D viewport
- Collapsible sidebar menu
- Adjusted chat input width

**Mobile (< 768px)**
- Priority to 3D character (full screen)
- Hamburger menu for navigation
- Bottom sheet for chat
- Optimized touch targets (min 48px)

## Critical Replit-Specific Adaptations

1. **Preview URL Compatibility**: Ensure all asset paths work with Replit's preview URLs
2. **WebGL Context**: Verify Three.js canvas initialization in preview iframe
3. **Audio Permissions**: Handle browser audio permissions for voice features
4. **Performance**: Monitor WebGL performance in Replit environment
5. **Asset Loading**: Ensure VRM models, textures load correctly from public directory

## Accessibility

- Keyboard navigation for all controls
- Screen reader labels for icon buttons
- Focus indicators (ring-2 ring-offset-2)
- ARIA labels for 3D character state
- Voice input as primary accessible input method

## Assets

**Icons**: Use existing icon library (@heroicons/react)
**3D Models**: VRM files from public/vrm directory
**Backgrounds**: Support for custom backgrounds in public/bg
**Animations**: Character animations from public/animation

No custom asset generation needed - all assets exist in repository.