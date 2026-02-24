/// <reference types="vite/client" />

declare module '*.css' {
  const src: string
  export default src
}

declare module '@nekkus/ui-kit/theme.css' {
  const src: string
  export default src
}
