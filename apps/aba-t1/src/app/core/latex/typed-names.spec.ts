import { catalogNames, markCommands, markSlots } from './typed-names';

describe('typed names', () => {
  it('marks list and matrix slots', () => {
    expect(markSlots('L1+M_0+L_{2}')).toBe('\\mathrm{L1}+\\mathrm{M0}+\\mathrm{L2}');
    expect(markSlots('\\mathrm{L1}')).toBe('\\mathrm{L1}');
    expect(markSlots('L12')).toBe('L12');
    expect(markSlots('AL1')).toBe('AL1');
  });

  it('marks catalogue words before a parenthesis', () => {
    expect(markCommands('sumlist(L1)', catalogNames())).toBe('\\operatorname{sumlist}(L1)');
    expect(markCommands('2x(x+1)', catalogNames())).toBe('2x(x+1)');
  });
});
