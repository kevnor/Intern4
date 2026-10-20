export const ROOM_PATHS = {
  ROOMS: '/rom',
  MINE: '/rom/mitt',
  ALL: '/rom/alle',
  // Static paths above rank before this parameterised one in React Router.
  DETAIL: '/rom/alle/:number',
};

export const roomPath = (number: number) => `${ROOM_PATHS.ALL}/${number}`;
