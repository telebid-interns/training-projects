class Error(Exception):
  def __init__(self, message, status_code):
    super(Exception, self).__init__(message)

    self.status_code = status_code

class PeerError(Error):
  def __init__(self, message, status_code):
    super(Error, self).__init__(message, status_code)

class UserError(Error):
  def __init__(self, message, status_code):
    super(Error, self).__init__(message, status_code)
