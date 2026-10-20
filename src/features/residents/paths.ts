export const RESIDENT_PATHS = {
  BEBOERE: '/beboere',
  BEBOER_STATISTIKK: '/beboere/statistikk',
  GAMLE_BEBOERE: '/beboere/gamle',
  // Static paths above rank before this parameterised one in React Router.
  BEBOER_PROFIL: '/beboere/:id',
};

export const residentProfilePath = (id: string) => `${RESIDENT_PATHS.BEBOERE}/${id}`;
