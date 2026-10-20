/**
 * Logos de la marca activa como módulos de Vite (hash y optimización de assets).
 * Deben ser los archivos que declara `activeBrand.assets`; `brandParity.test.ts`
 * lo verifica. Vite necesita imports estáticos, por eso viven aquí y no en la
 * definición de marca.
 */
import logo from '../../assets/emphasys-w.png';
import logoMark from '../../assets/emphasys-colibri-w.png';

export const brandLogos: { logo: string; logoMark: string } = { logo, logoMark };
