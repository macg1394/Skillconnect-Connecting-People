function viewProfile(anchorElement) {
    const userId = anchorElement.getAttribute('data_user_id');
    window.location.href = `/another_profile/${userId}`;
}