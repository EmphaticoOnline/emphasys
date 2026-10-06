import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useSession } from "../session/useSession";
import type { Empresa } from "../session/sessionTypes";
import { resolveRutaInicio } from "../utils/rutaInicio";
import { buildAssetUrl, fetchEmpresaAsset } from "../services/empresasAssetsService";
import { MAIN_NAV_TYPE } from "../theme/tokens";

const humanist = MAIN_NAV_TYPE.fontFamily;

function marca(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const letras = partes.map((parte) => parte[0] ?? "").join("");
  return (letras || "E").toUpperCase();
}

/** Color apagado a partir del logo. Ignora blancos, negros y grises. */
function acentoDesdeLogo(img: HTMLImageElement): string | null {
  const canvas = document.createElement("canvas");
  const lado = 24;
  canvas.width = lado;
  canvas.height = lado;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, lado, lado);
  let pixels: Uint8ClampedArray;
  try {
    pixels = ctx.getImageData(0, 0, lado, lado).data;
  } catch {
    return null;
  }

  let rojo = 0;
  let verde = 0;
  let azul = 0;
  let peso = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3] ?? 0;
    if (alpha < 180) continue;
    const r = pixels[i] ?? 0;
    const g = pixels[i + 1] ?? 0;
    const b = pixels[i + 2] ?? 0;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturacion = max === 0 ? 0 : (max - min) / max;
    const luz = (r + g + b) / 3;
    if (luz > 235 || luz < 30 || saturacion < 0.15) continue;
    rojo += r * saturacion;
    verde += g * saturacion;
    azul += b * saturacion;
    peso += saturacion;
  }
  if (peso === 0) return null;

  rojo /= peso;
  verde /= peso;
  azul /= peso;
  const gris = (rojo + verde + azul) / 3;
  const croma = 0.42;
  const mezclar = (canal: number) => Math.round(gris + (canal - gris) * croma);
  return `rgb(${mezclar(rojo)}, ${mezclar(verde)}, ${mezclar(azul)})`;
}

export default function SeleccionEmpresaPage() {
  const navigate = useNavigate();
  const { session, setSession } = useSession();
  const { frame, canvas, content } = useTheme().emphasys;
  const [logos, setLogos] = useState<Record<number, string | null>>({});
  const [logosRotos, setLogosRotos] = useState<Record<number, true>>({});
  const [acentos, setAcentos] = useState<Record<number, string>>({});

  const empresas: Empresa[] = session.empresas ?? [];

  useEffect(() => {
    if (!session.token) {
      navigate("/login", { replace: true });
      return;
    }

    if (empresas.length === 1) {
      const unica = empresas[0];
      if (unica) {
        const nextSession = { ...session, empresaActivaId: unica.id };
        setSession(nextSession);
        void (async () => {
          navigate(await resolveRutaInicio(nextSession), { replace: true });
        })();
      }
    }
  }, [session, empresas, navigate, setSession]);

  useEffect(() => {
    const lista = session.empresas ?? [];
    if (!session.token || lista.length === 0) return undefined;

    let activo = true;
    void Promise.all(
      lista.map(async (empresa) => {
        try {
          const asset = await fetchEmpresaAsset(empresa.id, "logo_default");
          return [empresa.id, asset?.ruta ? buildAssetUrl(asset.ruta) : null] as const;
        } catch {
          return [empresa.id, null] as const;
        }
      }),
    ).then((entradas) => {
      if (!activo) return;
      setLogos(Object.fromEntries(entradas));
    });

    return () => {
      activo = false;
    };
  }, [session.token, session.empresas]);

  const handleSelect = (empresa: Empresa) => {
    const nextSession = { ...session, empresaActivaId: empresa.id };
    setSession(nextSession);
    void (async () => {
      navigate(await resolveRutaInicio(nextSession), { replace: true });
    })();
  };

  if (!session.token) return null;

  return (
    <Box
      sx={{
        flex: 1,
        width: "100%",
        minHeight: "100%",
        boxSizing: "border-box",
        px: { xs: 2, sm: 3, md: 4 },
        py: { xs: 2.5, md: 1.5 },
        fontFamily: humanist,
        color: content.foreground,
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 880, mx: "auto" }}>
        <Typography
          component="p"
          sx={{
            m: 0,
            fontFamily: humanist,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: content.muted,
          }}
        >
          Espacio de trabajo
        </Typography>
        <Typography
          component="h1"
          sx={{
            m: 0,
            mt: 0.75,
            fontFamily: humanist,
            fontWeight: 500,
            fontSize: { xs: 26, md: 28 },
            lineHeight: 1.15,
            letterSpacing: "-0.03em",
            color: content.foreground,
          }}
        >
          Selecciona la empresa
        </Typography>
        <Typography
          component="p"
          sx={{
            m: 0,
            mt: 0.5,
            maxWidth: 460,
            fontFamily: humanist,
            fontWeight: 400,
            fontSize: 14,
            lineHeight: 1.4,
            color: content.secondary,
          }}
        >
          Elige con cuál deseas trabajar en esta sesión.
        </Typography>

        {empresas.length === 0 && (
          <Typography
            sx={{
              mt: 4,
              fontFamily: humanist,
              fontSize: 14,
              color: content.muted,
            }}
          >
            No hay empresas disponibles.
          </Typography>
        )}

        {empresas.length > 0 && (
          <Box
            sx={{
              mt: { xs: 2.5, md: 2 },
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              gap: { xs: 1.5, md: 1 },
            }}
          >
            {empresas.map((empresa) => {
              const acento = acentos[empresa.id] ?? frame.accent;
              const tieneLogo = Boolean(logos[empresa.id]) && !logosRotos[empresa.id];
              return (
                <Box
                  key={empresa.id}
                  component="button"
                  type="button"
                  onClick={() => handleSelect(empresa)}
                  sx={{
                    m: 0,
                    p: 0,
                    width: "100%",
                    appearance: "none",
                    font: "inherit",
                    textAlign: "left",
                    cursor: "pointer",
                    color: content.foreground,
                    backgroundColor: content.elevated,
                    border: `1px solid ${content.border}`,
                    borderRadius: "12px",
                    overflow: "hidden",
                    boxShadow: `0 1px 2px color-mix(in srgb, ${frame.background} 6%, transparent)`,
                    transition: "background-color 0.15s, box-shadow 0.15s, border-color 0.15s",
                    "&:hover": {
                      backgroundColor: content.hover,
                      borderColor: `color-mix(in srgb, ${acento} 45%, ${content.border})`,
                      boxShadow: `0 8px 22px color-mix(in srgb, ${frame.background} 8%, transparent)`,
                    },
                    "&:focus-visible": {
                      outline: `2px solid ${content.foreground}`,
                      outlineOffset: 2,
                    },
                  }}
                >
                  <Box
                    sx={{
                      height: { xs: 108, md: 84 },
                      boxSizing: "border-box",
                      px: 2.5,
                      py: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: canvas.page,
                      borderBottom: `1px solid ${content.border}`,
                      borderTop: `2px solid color-mix(in srgb, ${acento} 75%, transparent)`,
                    }}
                  >
                    {tieneLogo ? (
                      <Box
                        component="img"
                        src={logos[empresa.id]}
                        alt=""
                        onLoad={(event) => {
                          const color = acentoDesdeLogo(event.currentTarget);
                          if (!color) return;
                          setAcentos((prev) => (prev[empresa.id] === color ? prev : { ...prev, [empresa.id]: color }));
                        }}
                        onError={() => setLogosRotos((prev) => ({ ...prev, [empresa.id]: true }))}
                        sx={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          objectPosition: "center",
                          display: "block",
                        }}
                      />
                    ) : (
                      <Box
                        aria-hidden="true"
                        sx={{
                          fontFamily: humanist,
                          fontSize: { xs: 26, md: 22 },
                          fontWeight: 500,
                          letterSpacing: "0.06em",
                          lineHeight: 1,
                          color: content.foreground,
                        }}
                      >
                        {marca(empresa.nombre)}
                      </Box>
                    )}
                  </Box>
                  <Typography
                    component="span"
                    sx={{
                      display: "block",
                      px: 1.75,
                      py: { xs: 1.15, md: 0.875 },
                      fontFamily: humanist,
                      fontSize: 15,
                      fontWeight: 500,
                      letterSpacing: "0.005em",
                      lineHeight: 1.35,
                      color: content.foreground,
                    }}
                  >
                    {empresa.nombre}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </Box>
  );
}
