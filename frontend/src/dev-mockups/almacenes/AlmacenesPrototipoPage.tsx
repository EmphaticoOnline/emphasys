import { useEffect, useMemo, useState } from 'react';
import { CssBaseline } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import BrandThemeProvider from '../../theme/BrandThemeProvider';
import { ALMACENES_INICIALES, formularioVacio, type AlmacenMock, type FormularioAlmacen } from './datos';
import { FormularioAlmacenPrototipo } from './FormularioAlmacenPrototipo';
import { ListadoAlmacenesPrototipo } from './ListadoAlmacenesPrototipo';
import { TiraPrototipo } from './TiraPrototipo';

const BASE = '/dev/mockups/almacenes';

function leerRuta(pathname: string): { modo: 'lista' | 'nuevo' | 'editar'; id: number | null } {
  if (pathname === `${BASE}/nuevo`) return { modo: 'nuevo', id: null };
  const edicion = pathname.match(new RegExp(`^${BASE}/(\\d+)$`));
  if (edicion) return { modo: 'editar', id: Number(edicion[1]) };
  return { modo: 'lista', id: null };
}

export default function AlmacenesPrototipoPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const ruta = leerRuta(pathname);
  const [almacenes, setAlmacenes] = useState<AlmacenMock[]>(ALMACENES_INICIALES);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    const previo = document.title;
    document.title = 'Almacenes · prototipo';
    return () => {
      document.title = previo;
    };
  }, []);

  const actual = useMemo(
    () => (ruta.id == null ? null : almacenes.find((almacen) => almacen.id === ruta.id) ?? null),
    [almacenes, ruta.id],
  );

  const irLista = () => navigate(BASE);
  const irNuevo = () => navigate(`${BASE}/nuevo`);
  const irEditar = (id: number) => navigate(`${BASE}/${id}`);

  const alternar = (id: number) => {
    setAlmacenes((prev) => prev.map((almacen) => (
      almacen.id === id ? { ...almacen, activo: !almacen.activo } : almacen
    )));
    const almacen = almacenes.find((item) => item.id === id);
    setAviso(almacen?.activo ? 'Almacén desactivado' : 'Almacén activado');
  };

  const guardar = (form: FormularioAlmacen) => {
    const clave = form.clave.trim();
    const nombre = form.nombre.trim();
    const tipo = form.tipo.trim() || 'normal';
    if (ruta.modo === 'editar' && actual) {
      setAlmacenes((prev) => prev.map((almacen) => (
        almacen.id === actual.id ? { ...almacen, clave, nombre, tipo, activo: form.activo } : almacen
      )));
      setAviso('Almacén actualizado');
    } else {
      const id = Math.max(0, ...almacenes.map((almacen) => almacen.id)) + 1;
      setAlmacenes((prev) => [...prev, { id, clave, nombre, tipo, activo: form.activo }]);
      setAviso('Almacén creado');
    }
    irLista();
  };

  return (
    <BrandThemeProvider themeId="experimental">
      <CssBaseline />
      <TiraPrototipo modo={ruta.modo === 'lista' ? 'lista' : 'formulario'} onLista={irLista} onFormulario={irNuevo} />
      {ruta.modo === 'lista' ? (
        <ListadoAlmacenesPrototipo
          almacenes={almacenes}
          aviso={aviso}
          onCerrarAviso={() => setAviso('')}
          onNuevo={irNuevo}
          onEditar={irEditar}
          onAlternar={alternar}
        />
      ) : (
        <FormularioAlmacenPrototipo
          key={ruta.modo === 'editar' ? String(ruta.id) : 'nuevo'}
          almacen={ruta.modo === 'editar' ? actual : null}
          noEncontrado={ruta.modo === 'editar' && !actual}
          clavesOcupadas={almacenes
            .filter((almacen) => almacen.id !== actual?.id)
            .map((almacen) => almacen.clave.trim().toLowerCase())}
          inicial={actual
            ? { clave: actual.clave, nombre: actual.nombre, tipo: actual.tipo, activo: actual.activo }
            : formularioVacio()}
          onCancelar={irLista}
          onGuardar={guardar}
        />
      )}
    </BrandThemeProvider>
  );
}
