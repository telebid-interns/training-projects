class PeerError(Exception):
  def __init__(self, message, status_code):
    super(PeerError, self).__init__(message)
    self.status_code = status_code

class UserError(Exception):
  def __init__(self, message, status_code):
    super(UserError, self).__init__(message)
    self.status_code = status_code

class FileNotFoundException(IOError): # TODO remove
  def __init__(self, message=''):
    super(IOError, self).__init__(message)