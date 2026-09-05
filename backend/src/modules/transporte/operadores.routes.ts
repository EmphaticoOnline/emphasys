import {Router} from 'express';
import {requireAuth,requireEmpresaActiva} from '../auth/auth.middleware';
import * as c from './operadores.controller';
const r=Router(); r.use(requireAuth,requireEmpresaActiva);
r.get('/',c.listar); r.get('/:id',c.obtener); r.post('/',c.crear); r.put('/:id',c.actualizar); r.patch('/:id/activo',c.activo);
export default r;
