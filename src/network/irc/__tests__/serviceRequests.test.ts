import { beforeEach, describe, expect, it } from 'vitest';
import { clearServiceRequests, noteServiceRequest, SERVICE_REPLY_WINDOW_MS, serviceRequestWindow } from '../serviceRequests';

describe('serviceRequests', () => {
  beforeEach(() => {
    clearServiceRequests();
  });

  it('should send a service\'s replies to the window the user wrote to it from', () => {
    noteServiceRequest('PRIVMSG NickServ :INFO', '#chan', 1000);

    expect(serviceRequestWindow('NickServ', 1000)).toBe('#chan');
    expect(serviceRequestWindow('nickserv', 1000 + SERVICE_REPLY_WINDOW_MS)).toBe('#chan');
  });

  it('should forget the request after a while', () => {
    noteServiceRequest('PRIVMSG NickServ :INFO', '#chan', 1000);

    expect(serviceRequestWindow('NickServ', 1001 + SERVICE_REPLY_WINDOW_MS)).toBeUndefined();
  });

  it('should keep the last window per service', () => {
    noteServiceRequest('PRIVMSG NickServ :INFO', '#one', 1000);
    noteServiceRequest('@label=abc PRIVMSG nickserv :INFO', '#two', 2000);
    noteServiceRequest('PRIVMSG ChanServ :OP #two', '#three', 2000);

    expect(serviceRequestWindow('NickServ', 2000)).toBe('#two');
    expect(serviceRequestWindow('ChanServ', 2000)).toBe('#three');
  });

  it.each([
    'PRIVMSG alice :hi',
    'PRIVMSG #NickServ :hi',
    'NOTICE NickServ :hi',
    'WHOIS NickServ',
    '',
  ])('should ignore %j', (line) => {
    noteServiceRequest(line, '#chan', 1000);

    expect(serviceRequestWindow('NickServ', 1000)).toBeUndefined();
  });

  it('should forget everything on clear', () => {
    noteServiceRequest('PRIVMSG NickServ :INFO', '#chan', 1000);

    clearServiceRequests();

    expect(serviceRequestWindow('NickServ', 1000)).toBeUndefined();
  });
});
