import assert from 'node:assert/strict';
import { domicilioPrincipalDesdeContacto } from '../modules/contactos/contactos.repository';

const mapped = domicilioPrincipalDesdeContacto({
  calle: null,
  colonia: null,
  ciudad: null,
  estado: null,
  cp: null,
  pais: null,
  cp_sat: null,
  colonia_sat: null,
  domicilio_principal: {
    calle: 'Jose Ma. Heredia', numero_exterior: '2515', numero_interior: '3',
    colonia: '0282', colonia_sat: 'Eulogio Parra', ciudad: 'Guadalajara',
    estado: 'JAL', cp: '44670', cp_sat: '44670', pais: 'MEX',
  },
});

assert.deepEqual(mapped, {
  calle: 'Jose Ma. Heredia', numero_exterior: '2515', numero_interior: '3',
  colonia: '0282', colonia_sat: 'Eulogio Parra', ciudad: 'Guadalajara',
  estado: 'JAL', cp: '44670', cp_sat: '44670', pais: 'MEX',
});
console.log('contact-domicilio-mapping: OK', JSON.stringify(mapped));
