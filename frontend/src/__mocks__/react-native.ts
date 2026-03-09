export const Alert = {
  alert: jest.fn(),
};

export const Platform = {
  OS: 'ios',
  select: jest.fn((obj: any) => obj.ios),
};

export const StyleSheet = {
  create: (styles: any) => styles,
  hairlineWidth: 0.5,
  absoluteFill: {},
};
